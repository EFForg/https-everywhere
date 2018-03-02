#!/usr/bin/env python3.6

import binascii
import argparse
import copy
import json
import glob
import hashlib
import logging
import os
import queue
import re
import sys
import threading
import time

from configparser import SafeConfigParser

from lxml import etree

import http_client
import metrics
from rules import Ruleset
from rule_trie import RuleTrie


def convertLoglevel(levelString):
    """Converts string 'debug', 'info', etc. into corresponding
    logging.XXX value which is returned.

    @raises ValueError if the level is undefined
    """
    try:
        return getattr(logging, levelString.upper())
    except AttributeError:
        raise ValueError("No such loglevel - {}".format(levelString))


def getMetricClass(metricType):
    """Get class for metric type from config file.

    @raises ValueError if the metric type is unknown
    """
    metricMap = {
        "markup": metrics.MarkupMetric,
        "bsdiff": metrics.BSDiffMetric,
    }

    if metricType not in metricMap:
        raise ValueError("Metric type '{}' is not known".format(metricType))

    return metricMap[metricType]


class ComparisonTask(object):
    """Container for objects necessary for several plain/rewritten URL comparison
             associated with a single ruleset.
    """

    def __init__(self, urls, fetcherPlain, fetchersRewriting, ruleset):
        self.urls = urls
        self.fetcherPlain = fetcherPlain
        self.fetchersRewriting = fetchersRewriting
        self.ruleset = ruleset
        self.ruleFname = ruleset.filename


class UrlComparisonThread(threading.Thread):
    """Thread worker for comparing plain and rewritten URLs.
    """

    def __init__(self, taskQueue, metric, thresholdDistance, autoDisable, resQueue):
        """
        Comparison thread running HTTP/HTTPS scans.

        @param taskQueue: Queue.Queue filled with ComparisonTask objects
        @param metric: metric.Metric instance
        @param threshold: min distance that is reported as "too big"
        @param resQueue: Result Queue, results are added there
        """
        self.taskQueue = taskQueue
        self.resQueue = resQueue
        self.metric = metric
        self.thresholdDistance = thresholdDistance
        self.autoDisable = autoDisable
        threading.Thread.__init__(self)

    def run(self):
        while True:
            try:
                self.processTask(self.taskQueue.get())
                self.taskQueue.task_done()
            except Exception as e:
                logging.exception(e)
            if self.taskQueue.empty():
                break

    def processTask(self, task):
        problems = []
        for url in task.urls:
            result = self.processUrl(url, task)
            if result:
                problems.append(result)
        if problems:
            for problem in problems:
                logging.error("{}: {}".format(task.ruleFname, problem))
            if self.autoDisable:
                disableRuleset(task.ruleset, problems)

    def queue_result(self, result, details, fname, url, https_url=None):
        """
        Add results to result Queue

        @param result: Result of the test. "error" or "success"
        @param details: More detailed results (in case of error)
        @param fname: rule file name
        @param  url: base url of the test (http)
        @param https_url: re-written https url
        """

        res = {"result": result,
               "details": details,
               "fname": fname,
               "url": url}
        if https_url:
            res["https_url"] = https_url
        self.resQueue.put(res)

    def fetchUrl(self, plainUrl, transformedUrl, fetcherPlain, fetcherRewriting, ruleFname):
        logging.debug("=**= Start {} => {} ****".format(plainUrl, transformedUrl))
        logging.debug("Fetching transformed page {}".format(transformedUrl))
        transformedRcode, transformedPage = fetcherRewriting.fetchHtml(
            transformedUrl)
        logging.debug("Fetching plain page {}".format(plainUrl))
        # If we get an exception (e.g. connection refused,
        # connection timeout) on the plain page, don't treat
        # that as a failure (except DNS resolution errors)
        plainRcode, plainPage = None, None
        try:
            plainRcode, plainPage = fetcherPlain.fetchHtml(plainUrl)
        except Exception as e:
            errno, message = e.args
            if errno == 6:
                message = "Fetch error: {} => {}: {}".format(
                    plainUrl, transformedUrl, e)
                self.queue_result("error", "fetch-error {}".format(e),
                                  ruleFname, plainUrl, https_url=transformedUrl)
                return message

            logging.debug(
                "Non-fatal fetch error for plain page {}: {}".format(plainUrl, e))

        # Compare HTTP return codes - if original page returned 2xx,
        # but the transformed didn't, consider it an error in ruleset
        # (note this is not symmetric, we don't care if orig page is broken).
        # We don't handle 1xx codes for now.
        if plainRcode and plainRcode//100 == 2 and transformedRcode//100 != 2:
            message = "Non-2xx HTTP code: {} ({}) => {} ({})".format(
                plainUrl, plainRcode, transformedUrl, transformedRcode)
            self.queue_result("error", "non-2xx http code",
                              ruleFname, plainUrl, https_url=transformedUrl)
            logging.debug(message)
            return message

        # If the plain page fetch got an exception, we don't
        # need to do the distance comparison. Intuitively, if a
        # plain page is fetchable people expect it to have the
        # same content as the HTTPS page. But if the plain page
        # is unreachable, there's nothing to compare to.
        if plainPage:
            distance = self.metric.distanceNormed(plainPage, transformedPage)

            logging.debug("==== D: {:.4f}; {} ({}) -> {} ({}) =====".format(
                          distance, plainUrl, len(plainPage), transformedUrl, len(transformedPage)))
            if distance >= self.thresholdDistance:
                logging.info("Big distance {:.4f}: {} ({}) -> {} ({}). Rulefile: {} =====".format(
                             distance, plainUrl, len(plainPage), transformedUrl, len(transformedPage), ruleFname))

        self.queue_result("success", "", ruleFname, plainUrl)

    def processUrl(self, plainUrl, task):
        fetcherPlain = task.fetcherPlain
        fetchersRewriting = task.fetchersRewriting
        ruleFname = task.ruleFname

        try:
            transformedUrl = task.ruleset.apply(plainUrl)
        except Exception as e:
            self.queue_result("regex_error", str(e), ruleFname, plainUrl)
            logging.error("{}: Regex Error {}".format(ruleFname, str(e)))
            return

        fetchersFailed = 0
        for fetcherRewriting in fetchersRewriting:
            try:
                message = self.fetchUrl(
                    plainUrl, transformedUrl, fetcherPlain, fetcherRewriting, ruleFname)
                break

            except Exception as e:
                fetchersFailed += 1
                if fetchersFailed == len(fetchersRewriting):
                    message = "Fetch error: {} => {}: {}".format(
                        plainUrl, transformedUrl, e)
                    self.queue_result("error", "fetch-error {}".format(e),
                                    ruleFname, plainUrl, https_url=transformedUrl)
                    logging.debug(message)

        logging.info("Finished comparing {} -> {}. Rulefile: {}.".format(
                    plainUrl, transformedUrl, ruleFname))

        return message


def disableRuleset(ruleset, problems):
    logging.info("Disabling ruleset {}".format(ruleset.filename))
    contents = open(ruleset.filename).read()
    # Don't bother to disable rulesets that are already disabled
    if re.search("\bdefault_off=", contents):
        return
    contents = re.sub("(<ruleset [^>]*)>",
                      "\\1 default_off='failed ruleset test'>", contents)

    # Since the problems are going to be inserted into an XML comment, they cannot
    # contain "--", or they will generate a parse error. Split up all "--" with a
    # space in the middle.
    safeProblems = [re.sub('--', '- -', p) for p in problems]
    # If there's not already a comment section at the beginning, add one.
    if not re.search("^<!--", contents):
        contents = "<!--\n-->\n" + contents
    problemStatement = ("""
<!--
Disabled by https-everywhere-checker because:
{}
""".format("\n".join(problems)))
    contents = re.sub("^<!--", problemStatement, contents)
    with open(ruleset.filename, "w") as f:
        f.write(contents)


# A dict indexed by binary SHA256 hashes. A ruleset whose hash matches an entry in
# the skiplist will skip tests. This is a way to grandfather in rules written
# before the coverage tests were required, but also require coverage
# improvements when updating the rules.
skipdict = {}


def skipFile(filename):
    hasher = hashlib.new('sha256')
    hasher.update(open(filename, 'rb').read())
    if hasher.digest() in skipdict:
        return True
    else:
        return False


def json_output(resQueue, json_file, problems):
    """
    output results in json format

    @param resQueue: The result Queue
    @param json_file: json file name to write to
    @param problems: A list of problems in XML files
    """
    data = {}
    try:
        res = resQueue.get_nowait()
        while res:
            result_val = res["result"]
            del (res["result"])
            if not result_val in data:
                data[result_val] = []
            data[result_val].append(res)

            res = resQueue.get_nowait()
    except queue.Empty:
        pass  # Got everything

    data["coverage"] = problems

    with open(json_file, "wt") as fh:
        json.dump(data, fh, indent=4)


def cli():
    parser = argparse.ArgumentParser(
        description='Check HTTPs rules for validity')
    parser.add_argument(
        'checker_config', help='an integer for the accumulator')
    parser.add_argument('rule_files', nargs="*", default=[],
                        help="Specific XML rule files")
    parser.add_argument('--json_file', default=None,
                        help='write results in json file')
    args = parser.parse_args()

    config = SafeConfigParser()
    config.read(args.checker_config)

    logfile = config.get("log", "logfile")
    loglevel = convertLoglevel(config.get("log", "loglevel"))
    if logfile == "-":
        logging.basicConfig(stream=sys.stderr, level=loglevel,
                            format="%(levelname)s %(message)s")
    else:
        logging.basicConfig(filename=logfile, level=loglevel,
                            format="%(asctime)s %(levelname)s %(message)s [%(pathname)s:%(lineno)d]")

    autoDisable = False
    if config.has_option("rulesets", "auto_disable"):
        autoDisable = config.getboolean("rulesets", "auto_disable")
    # Test rules even if they have default_off=...
    includeDefaultOff = False
    if config.has_option("rulesets", "include_default_off"):
        includeDefaultOff = config.getboolean(
            "rulesets", "include_default_off")
    ruledir = config.get("rulesets", "rulesdir")
    checkCoverage = False
    if config.has_option("rulesets", "check_coverage"):
        checkCoverage = config.getboolean("rulesets", "check_coverage")
    checkTargetValidity = False
    if config.has_option("rulesets", "check_target_validity"):
        checkTargetValidity = config.getboolean(
            "rulesets", "check_target_validity")
    checkNonmatchGroups = False
    if config.has_option("rulesets", "check_nonmatch_groups"):
        checkNonmatchGroups = config.getboolean(
            "rulesets", "check_nonmatch_groups")
    checkTestFormatting = False
    if config.has_option("rulesets", "check_test_formatting"):
        checkTestFormatting = config.getboolean(
            "rulesets", "check_test_formatting")
    certdir = config.get("certificates", "basedir")
    if config.has_option("rulesets", "skiplist") and config.has_option("rulesets", "skipfield"):
        skiplist = config.get("rulesets", "skiplist")
        skipfield = config.get("rulesets", "skipfield")
        with open(skiplist) as f:
            f.readline()
            for line in f:
                splitLine = line.split(",")
                fileHash = splitLine[0]
                if splitLine[int(skipfield)] == "1":
                    skipdict[binascii.unhexlify(fileHash)] = 1

    threadCount = config.getint("http", "threads")
    httpEnabled = True
    if config.has_option("http", "enabled"):
        httpEnabled = config.getboolean("http", "enabled")

    metricName = config.get("thresholds", "metric")
    thresholdDistance = config.getfloat("thresholds", "max_distance")
    metricClass = getMetricClass(metricName)
    metric = metricClass()

    # Debugging options, graphviz dump
    dumpGraphvizTrie = False
    if config.has_option("debug", "dump_graphviz_trie"):
        dumpGraphvizTrie = config.getboolean("debug", "dump_graphviz_trie")
    if dumpGraphvizTrie:
        graphvizFile = config.get("debug", "graphviz_file")
        exitAfterDump = config.getboolean("debug", "exit_after_dump")

    if args.rule_files:
        xmlFnames = args.rule_files
    else:
        xmlFnames = glob.glob(os.path.join(ruledir, "*.xml"))
    trie = RuleTrie()

    rulesets = []
    coverageProblemsExist = False
    targetValidityProblemExist = False
    nonmatchGroupProblemsExist = False
    testFormattingProblemsExist = False
    for xmlFname in xmlFnames:
        logging.debug("Parsing {}".format(xmlFname))
        if skipFile(xmlFname):
            logging.debug(
                "Skipping rule file '{}', matches skiplist.".format(xmlFname))
            continue

        ruleset = Ruleset(etree.parse(open(xmlFname, "rb")).getroot(), xmlFname)
        if ruleset.defaultOff and not includeDefaultOff:
            logging.debug("Skipping rule '{}', reason: {}".format(
                          ruleset.name, ruleset.defaultOff))
            continue
        # Check whether ruleset coverage by tests was sufficient.
        if checkCoverage:
            logging.debug("Checking coverage for '{}'.".format(ruleset.name))
            problems = ruleset.getCoverageProblems()
            for problem in problems:
                coverageProblemsExist = True
                logging.error(problem)
        if checkTargetValidity:
            logging.debug("Checking target validity for '{}'.".format(ruleset.name))
            problems = ruleset.getTargetValidityProblems()
            for problem in problems:
                targetValidityProblemExist = True
                logging.error(problem)
        if checkNonmatchGroups:
            logging.debug("Checking non-match groups for '{}'.".format(ruleset.name))
            problems = ruleset.getNonmatchGroupProblems()
            for problem in problems:
                nonmatchGroupProblemsExist = True
                logging.error(problem)
        if checkTestFormatting:
            logging.debug("Checking test formatting for '{}'.".format(ruleset.name))
            problems = ruleset.getTestFormattingProblems()
            for problem in problems:
                testFormattingProblemsExist = True
                logging.error(problem)
        trie.addRuleset(ruleset)
        rulesets.append(ruleset)

    # Trie is built now, dump it if it's set in config
    if dumpGraphvizTrie:
        logging.debug("Dumping graphviz ruleset trie")
        graph = trie.generateGraphizGraph()
        if graphvizFile == "-":
            graph.dot()
        else:
            with open(graphvizFile, "w") as gvFd:
                graph.dot(gvFd)
        if exitAfterDump:
            sys.exit(0)
    fetchOptions = http_client.FetchOptions(config)
    fetchers = list()

    # Ensure "default" is in the platform dirs
    if not os.path.isdir(os.path.join(certdir, "default")):
        raise RuntimeError(
            "Platform 'default' is missing from certificate directories")

    platforms = http_client.CertificatePlatforms(
        os.path.join(certdir, "default"))
    fetchers.append(http_client.HTTPFetcher(
        "default", platforms, fetchOptions, trie))
    # fetches pages with unrewritten URLs
    fetcherPlain = http_client.HTTPFetcher("default", platforms, fetchOptions)

    urlList = []
    if config.has_option("http", "url_list"):
        with open(config.get("http", "url_list")) as urlFile:
            urlList = [line.rstrip() for line in urlFile.readlines()]

    if httpEnabled:
        taskQueue = queue.Queue(1000)
        resQueue = queue.Queue()
        startTime = time.time()
        testedUrlPairCount = 0
        config.getboolean("debug", "exit_after_dump")

        for i in range(threadCount):
            t = UrlComparisonThread(
                taskQueue, metric, thresholdDistance, autoDisable, resQueue)
            t.setDaemon(True)
            t.start()

        # set of main pages to test
        mainPages = set(urlList)
        # If list of URLs to test/scan was not defined, use the test URL extraction
        # methods built into the Ruleset implementation.
        if not urlList:
            for ruleset in rulesets:
                if ruleset.platform != "default" and os.path.isdir(os.path.join(certdir, ruleset.platform)):
                    theseFetchers = copy.deepcopy(fetchers)
                    platforms.addPlatform(ruleset.platform, os.path.join(certdir, ruleset.platform))
                    theseFetchers.append(http_client.HTTPFetcher(
                        ruleset.platform, platforms, fetchOptions, trie))
                else:
                    theseFetchers = fetchers
                testUrls = []
                for test in ruleset.tests:
                    if not ruleset.excludes(test.url):
                        testedUrlPairCount += 1
                        testUrls.append(test.url)
                    else:
                        # TODO: We should fetch the non-rewritten exclusion URLs to make
                        # sure they still exist.
                        logging.debug("Skipping excluded URL {}".format(test.url))
                task = ComparisonTask(testUrls, fetcherPlain, theseFetchers, ruleset)
                taskQueue.put(task)

        taskQueue.join()
        logging.info("Finished in {:.2f} seconds. Loaded rulesets: {}, URL pairs: {}.".format(
                     time.time() - startTime, len(xmlFnames), testedUrlPairCount))
        if args.json_file:
            json_output(resQueue, args.json_file, problems)
    if checkCoverage:
        if coverageProblemsExist:
            return 1  # exit with error code
    if checkTargetValidity:
        if targetValidityProblemExist:
            return 1  # exit with error code
    if checkNonmatchGroups:
        if nonmatchGroupProblemsExist:
            return 1  # exit with error code
    if checkTestFormatting:
        if testFormattingProblemsExist:
            return 1  # exit with error code
    return 0  # exit with success


if __name__ == '__main__':
    sys.exit(cli())
