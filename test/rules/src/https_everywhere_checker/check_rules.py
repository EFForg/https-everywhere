#!/usr/bin/env python

import binascii
import collections
import argparse
import json
import glob
import hashlib
import logging
import os
import Queue
import re
import sys
import threading
import time

from ConfigParser import SafeConfigParser

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
		raise ValueError("No such loglevel - %s" % levelString)

def getMetricClass(metricType):
	"""Get class for metric type from config file.
	
	@raises ValueError if the metric type is unknown
	"""
	metricMap = {
		"markup": metrics.MarkupMetric,
		"bsdiff": metrics.BSDiffMetric,
	}
	
	if metricType not in metricMap:
		raise ValueError("Metric type '%s' is not known" % metricType)
	
	return metricMap[metricType]


class ComparisonTask(object):
	"""Container for objects necessary for several plain/rewritten URL comparison
		 associated with a single ruleset.
	"""
	
	def __init__(self, urls, fetcherPlain, fetcherRewriting, ruleset):
		self.urls = urls
		self.fetcherPlain = fetcherPlain
		self.fetcherRewriting = fetcherRewriting
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
			except Exception, e:
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
				logging.error("%s: %s" % (task.ruleFname, problem))
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
		logging.debug("=**= Start %s => %s ****", plainUrl, transformedUrl)
		logging.debug("Fetching transformed page %s", transformedUrl)
		transformedRcode, transformedPage = fetcherRewriting.fetchHtml(transformedUrl)
		logging.debug("Fetching plain page %s", plainUrl)
		# If we get an exception (e.g. connection refused,
		# connection timeout) on the plain page, don't treat
		# that as a failure (except DNS resolution errors)
		plainRcode, plainPage = None, None
		try:
			plainRcode, plainPage = fetcherPlain.fetchHtml(plainUrl)
		except Exception, e:
			errno, message = e
			if errno == 6:
				message = "Fetch error: %s => %s: %s" % (
					plainUrl, transformedUrl, e)
				self.queue_result("error", "fetch-error %s"% e, ruleFname, plainUrl, https_url=transformedUrl)
				return message

			logging.debug("Non-fatal fetch error for plain page %s: %s" % (plainUrl, e))

		# Compare HTTP return codes - if original page returned 2xx,
		# but the transformed didn't, consider it an error in ruleset
		# (note this is not symmetric, we don't care if orig page is broken).
		# We don't handle 1xx codes for now.
		if plainRcode and plainRcode//100 == 2 and transformedRcode//100 != 2:
			message = "Non-2xx HTTP code: %s (%d) => %s (%d)" % (
				plainUrl, plainRcode, transformedUrl, transformedRcode)
			self.queue_result("error", "non-2xx http code", ruleFname, plainUrl, https_url=transformedUrl)
			logging.debug(message)
			return message

		# If the plain page fetch got an exception, we don't
		# need to do the distance comparison. Intuitively, if a
		# plain page is fetchable people expect it to have the
		# same content as the HTTPS page. But if the plain page
		# is unreachable, there's nothing to compare to.
		if plainPage:
			distance = self.metric.distanceNormed(plainPage, transformedPage)

			logging.debug("==== D: %0.4f; %s (%d) -> %s (%d) =====",
				distance, plainUrl, len(plainPage), transformedUrl, len(transformedPage))
			if distance >= self.thresholdDistance:
				logging.info("Big distance %0.4f: %s (%d) -> %s (%d). Rulefile: %s =====",
					distance, plainUrl, len(plainPage), transformedUrl, len(transformedPage), ruleFname)

		self.queue_result("success", "", ruleFname, plainUrl)

	def processUrl(self, plainUrl, task):
		fetcherPlain = task.fetcherPlain
		fetcherRewriting = task.fetcherRewriting
		ruleFname = task.ruleFname

		try:
			transformedUrl = task.ruleset.apply(plainUrl)
		except Exception, e:
			self.queue_result("regex_error", str(e), ruleFname, plainUrl)
			logging.error("%s: Regex Error %s" % (ruleFname, str(e)))
			return

		try:
			message = self.fetchUrl(plainUrl, transformedUrl, fetcherPlain, fetcherRewriting, ruleFname)

		except:
                        # Try once more before sending an error result
			try:
		            message = self.fetchUrl(plainUrl, transformedUrl, fetcherPlain, fetcherRewriting, ruleFname)
			except Exception, e:
			    message = "Fetch error: %s => %s: %s" % (
				    plainUrl, transformedUrl, e)
			    self.queue_result("error", "fetch-error %s"% e, ruleFname, plainUrl, https_url=transformedUrl)
			    logging.debug(message)

		finally:
			logging.info("Finished comparing %s -> %s. Rulefile: %s.",
				plainUrl, transformedUrl, ruleFname)

		return message

def disableRuleset(ruleset, problems):
	logging.info("Disabling ruleset %s", ruleset.filename)
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
%s
""" % "\n".join(problems))
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
	hasher.update(open(filename).read())
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
	except Queue.Empty:
		pass # Got everything

	data["coverage"] = problems

	with open(json_file, "wt") as fh:
		json.dump(data, fh, indent = 4)

def cli():
	parser = argparse.ArgumentParser(description='Check HTTPs rules for validity')
	parser.add_argument('checker_config', help='an integer for the accumulator')
	parser.add_argument('rule_files', nargs="*", default=[], help="Specific XML rule files")
	parser.add_argument('--json_file', default=None, help='write results in json file')
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
		includeDefaultOff = config.getboolean("rulesets", "include_default_off")
	ruledir = config.get("rulesets", "rulesdir")
	checkCoverage = False
	if config.has_option("rulesets", "check_coverage"):
		checkCoverage = config.getboolean("rulesets", "check_coverage")
	checkTargetValidity = False
	if config.has_option("rulesets", "check_target_validity"):
		checkTargetValidity = config.getboolean("rulesets", "check_target_validity")
	checkNonmatchGroups = False
	if config.has_option("rulesets", "check_nonmatch_groups"):
		checkNonmatchGroups = config.getboolean("rulesets", "check_nonmatch_groups")
	checkTestFormatting = False
	if config.has_option("rulesets", "check_test_formatting"):
		checkTestFormatting = config.getboolean("rulesets", "check_test_formatting")
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
	
	#get all platform dirs, make sure "default" is among them
	certdirFiles = glob.glob(os.path.join(certdir, "*"))
	havePlatforms = set([os.path.basename(fname) for fname in certdirFiles if os.path.isdir(fname)])
	logging.debug("Loaded certificate platforms: %s", ",".join(havePlatforms))
	if "default" not in havePlatforms:
		raise RuntimeError("Platform 'default' is missing from certificate directories")
	
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
		logging.debug("Parsing %s", xmlFname)
		if skipFile(xmlFname):
			logging.debug("Skipping rule file '%s', matches skiplist." % xmlFname)
			continue

		try:
			ruleset = Ruleset(etree.parse(file(xmlFname)).getroot(), xmlFname)
		except Exception, e:
			logging.error("Exception parsing %s: %s" % (xmlFname, e))
		if ruleset.defaultOff and not includeDefaultOff:
			logging.debug("Skipping rule '%s', reason: %s", ruleset.name, ruleset.defaultOff)
			continue
		# Check whether ruleset coverage by tests was sufficient.
		if checkCoverage:
			logging.debug("Checking coverage for '%s'." % ruleset.name)
			problems = ruleset.getCoverageProblems()
			for problem in problems:
				coverageProblemsExist = True
				logging.error(problem)
		if checkTargetValidity:
			logging.debug("Checking target validity for '%s'." % ruleset.name)
			problems = ruleset.getTargetValidityProblems()
			for problem in problems:
				targetValidityProblemExist = True
				logging.error(problem)
		if checkNonmatchGroups:
			logging.debug("Checking non-match groups for '%s'." % ruleset.name)
			problems = ruleset.getNonmatchGroupProblems()
			for problem in problems:
				nonmatchGroupProblemsExist = True
				logging.error(problem)
		if checkTestFormatting:
			logging.debug("Checking test formatting for '%s'." % ruleset.name)
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
			with file(graphvizFile, "w") as gvFd:
				graph.dot(gvFd)
		if exitAfterDump:
			sys.exit(0)
	fetchOptions = http_client.FetchOptions(config)
	fetcherMap = dict() #maps platform to fetcher
	
	platforms = http_client.CertificatePlatforms(os.path.join(certdir, "default"))
	for platform in havePlatforms:
		#adding "default" again won't break things
		platforms.addPlatform(platform, os.path.join(certdir, platform))
		fetcher = http_client.HTTPFetcher(platform, platforms, fetchOptions, trie)
		fetcherMap[platform] = fetcher
	
	#fetches pages with unrewritten URLs
	fetcherPlain = http_client.HTTPFetcher("default", platforms, fetchOptions)
	
	urlList = []
	if config.has_option("http", "url_list"):
		with file(config.get("http", "url_list")) as urlFile:
			urlList = [line.rstrip() for line in urlFile.readlines()]
			
	if httpEnabled:
		taskQueue = Queue.Queue(1000)
		resQueue = Queue.Queue()
		startTime = time.time()
		testedUrlPairCount = 0
		config.getboolean("debug", "exit_after_dump")

		for i in range(threadCount):
			t = UrlComparisonThread(taskQueue, metric, thresholdDistance, autoDisable, resQueue)
			t.setDaemon(True)
			t.start()

		# set of main pages to test
		mainPages = set(urlList)
		# If list of URLs to test/scan was not defined, use the test URL extraction
		# methods built into the Ruleset implementation.
		if not urlList:
			for ruleset in rulesets:
				testUrls = []
				for test in ruleset.tests:
					if not ruleset.excludes(test.url):
						testedUrlPairCount += 1
						testUrls.append(test.url)
					else:
						# TODO: We should fetch the non-rewritten exclusion URLs to make
						# sure they still exist.
						logging.debug("Skipping excluded URL %s", test.url)
				task = ComparisonTask(testUrls, fetcherPlain, fetcher, ruleset)
				taskQueue.put(task)

		taskQueue.join()
		logging.info("Finished in %.2f seconds. Loaded rulesets: %d, URL pairs: %d.",
			time.time() - startTime, len(xmlFnames), testedUrlPairCount)
		if args.json_file:
			json_output(resQueue, args.json_file, problems)
	if checkCoverage:
		if coverageProblemsExist:
			return 1 # exit with error code
	if checkTargetValidity:
		if targetValidityProblemExist:
			return 1 # exit with error code
	if checkNonmatchGroups:
		if nonmatchGroupProblemsExist:
			return 1 # exit with error code
	if checkTestFormatting:
		if testFormattingProblemsExist:
			return 1 # exit with error code
	return 0 # exit with success

if __name__ == '__main__':
	sys.exit(cli())
