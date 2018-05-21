from tldextract import tldextract
from urllib.parse import urlparse

import regex
import socket


class Rule(object):
    """Represents one from->to rule element."""

    def __init__(self, ruleElem):
        """Convert one <rule> element.
        @param: etree <rule>Element
        """
        attrs = ruleElem.attrib
        self.fromPattern = attrs["from"]
        # Switch $1, $2... JS capture patterns to Python \g<1>, \g<2>...
        # The \g<1> named capture is used instead of \1 because it would
        # break for rules whose domain begins with a digit.
        self.toPattern = regex.sub(r"\$(\d)", r"\\g<\1>", attrs["to"])
        self.fromRe = regex.compile(self.fromPattern)
        # Test cases that this rule applies to.
        self.tests = []

    def apply(self, url):
        """Apply rule to URL string and return result."""
        return self.fromRe.sub(self.toPattern, url)

    def matches(self, url):
        """Returns true iff this rule matches given url
        @param url: URL to check as string
        """
        return self.fromRe.search(url) is not None

    def __repr__(self):
        return "<Rule from '{}' to '{}'>".format(self.fromRe.pattern, self.toPattern)

    def __str__(self):
        return self.__repr__()

    def _id(self):
        """Indentity for __eq__ and __hash__"""
        return (self.fromPattern, self.toPattern)

    def __eq__(self, other):
        return self._id() == other._id()

    def __hash__(self):
        return hash(self._id())


class Exclusion(object):
    """Exclusion rule for <exclusion pattern=""> element"""

    def __init__(self, exclusionElem):
        """Create instance from <exclusion> element
        @param exclusionElem: <exclusion> element from lxml tree
        """
        self.exclusionPattern = exclusionElem.attrib["pattern"]
        self.exclusionRe = regex.compile(self.exclusionPattern)
        # Test cases that this exclusion applies to.
        self.tests = []

    def matches(self, url):
        """Returns true iff this exclusion rule matches given url
        @param url: URL to check as string
        """
        return self.exclusionRe.search(url) is not None

    def __repr__(self):
        return "<Exclusion pattern '{}'>".format(self.exclusionPattern)


class Test(object):
    """A test case from a <test url=""> element"""

    def __init__(self, url):
        """Create instance from <test> element
        @param exclusionElem: <test> element from lxml tree
        """
        self.url = url

    def __eq__(test1, test2):
        return test1.url == test2.url

    def __hash__(self):
        return self.url.__hash__()

class Ruleset(object):
    """Represents one XML ruleset file."""

    # extracts value of first attribute in list as a string
    def _strAttr(attrList): return attrList[0]

    # extract attribute value
    def _targetAttrs(attrList): return tuple(attr for attr in attrList)

    # convert each etree Element of list into Rule
    def _rulesConvert(elemList): return [Rule(elem) for elem in elemList]

    # convert each etree Element of list into Exclusion
    def _exclusionConvert(elemList): return [
        Exclusion(elem) for elem in elemList]

    def _testConvert(elemList): return [Test(
        elem.attrib["url"]) for elem in elemList]

    # functional description of converting XML elements/attributes into
    # instance variables. Tuples are:
    #(attribute name in this class, XPath expression, conversion function into value)
    _attrConvert = [
        ("name",	"@name", 		_strAttr),
        ("platform",	"@platform", 		_strAttr),
        ("defaultOff",	"@default_off", 	_strAttr),
        ("targets",	"target/@host",		_targetAttrs),
        ("rules",	"rule", 		_rulesConvert),
        ("exclusions",	"exclusion", 		_exclusionConvert),
        ("tests",	"test", 		_testConvert),
    ]

    def __init__(self, xmlTree, filename):
        """Create instance from given XML (sub)tree.

        @param xmlTree: XML (sub)tree corresponding to the <ruleset> element
        @param filename: filename this ruleset originated from (for
        reporting purposes)
        """
        root = xmlTree
        # set default values for rule attributes, makes it easier for
        # code completion
        self.name = None
        self.platform = "default"
        self.defaultOff = None
        self.rules = []
        self.targets = []
        self.exclusions = []
        self.filename = filename
        self.tests = []
        self.determine_test_application_run = False

        for (attrName, xpath, conversion) in self._attrConvert:
            elems = root.xpath(xpath)
            if elems:
                setattr(self, attrName, conversion(elems))

        self._addTests()

    def excludes(self, url):
        """Returns True iff one of exclusion patterns matches the url."""
        return any((exclusion.matches(url) for exclusion in self.exclusions))

    def apply(self, url):
        """Apply rules from this ruleset on the given url. Exclusions
        are checked.

        @param url: string URL
        """
        if self.excludes(url):
            return url

        for rule in self.rules:
            try:
                newUrl = rule.apply(url)
                if url != newUrl:
                    return newUrl  # only one rewrite
            except Exception as e:
                raise Exception(e.__str__() + " " + rule.fromPattern)

        return url  # nothing rewritten

    def _addTests(self):
        """In addition to any tests provided as <test> elements, add a test case for
        each non-wildcard target."""
        for target in self.targets:
            if '*' in target:
                continue
            self.tests.append(Test("http://{}/".format(target)))

    def _determineTestApplication(self):
        """Match each test against a rule or exclusion if possible, and hang them
                 off that rule or exclusion.  Return any coverage problems."""
        if not self.determine_test_application_run:
            self.test_application_problems = []

            # check for duplicated test urls
            if len(self.tests) != len(set(self.tests)):
                for test in set(self.tests):
                    if self.tests.count(test) > 1:
                        self.test_application_problems.append("%s: Duplicated test URL found %s" % (
                            self.filename, test.url))

            for test in self.tests:
                applies = self.whatApplies(test.url)
                if applies:
                    applies.tests.append(test)
                else:
                    self.test_application_problems.append("{}: No rule or exclusion applies to test URL {}".format(
                        self.filename, test.url))

            for test in self.tests:
                urlParts = urlparse(test.url)
                hostname = urlParts.hostname

                isCovered = hostname in self.targets

                if not isCovered:
                    parts = hostname.split('.')

                    for i in range(len(parts)):
                        tmp = parts[i]
                        parts[i] = '*'

                        if '.'.join(parts) in self.targets:
                            isCovered = True
                            break

                        if '.'.join(parts[i:len(parts)]) in self.targets:
                            isCovered = True
                            break

                        parts[i] = tmp

                if not isCovered:
                    self.test_application_problems.append("{}: No target applies to test URL {}".format(
                        self.filename, test.url))

            self.determine_test_application_run = True
        return self.test_application_problems

    def getTargetValidityProblems(self):
        """Verify that each target has a valid TLD in order to prevent problematic rewrite
                 as stated in EFForg/https-everywhere/issues/10877. In particular,
                 right-wildcard target are ignored from this test.

                 Returns an array of strings reporting any coverage problems if they exist,
                 or empty list if coverage is sufficient.
                 """
        problems = self._determineTestApplication()

        # Next, make sure each target has a valid TLD and doesn't overlap with others
        for target in self.targets:
            # If it's a wildcard, check which other targets it covers
            if '*' in target:
                target_re = regex.escape(target)

                if target_re.startswith(r'\*'):
                    target_re = target_re[2:]
                else:
                    target_re = r'\A' + target_re

                target_re = regex.compile(
                    target_re.replace(r'\*', r'[^.]*') + r'\Z')

                others = [other for other in self.targets if other !=
                          target and target_re.search(other)]

                if others:
                    problems.append("{}: Target '{}' also covers {}".format(self.filename, target, others))

            # Ignore right-wildcard targets for TLD checks
            if target.endswith(".*"):
                continue

            # Ignore if target is an ipv4 address
            try:
                socket.inet_aton(target)
                continue
            except:
                pass

            # Ignore if target is an ipv6 address
            try:
                socket.inet_pton(socket.AF_INET6, target)
                continue
            except:
                pass

            # Extract TLD from target if possible
            res = tldextract.extract(target)
            if res.suffix == "":
                problems.append("{}: Target '{}' missing eTLD".format(self.filename, target))
            elif res.domain == "":
                problems.append("{}: Target '{}' containing entire eTLD".format(
                    self.filename, target))

        return problems

    def getCoverageProblems(self):
        """Verify that each target, rule and exclusion has the right number of tests
                 that applies to it. Also check that each target has the right
                 number of tests. In particular left-wildcard targets should have at least
                 three tests. Right-wildcard targets should have at least ten tests.

                 Returns an array of strings reporting any coverage problems if they exist,
                 or empty list if coverage is sufficient.
                 """
        self._determineTestApplication()
        problems = []

        # First, check each target has the right number of tests
        myTestTargets = []

        # Only take tests which are not excluded into account
        for test in self.tests:
            if not self.excludes(test.url):
                urlParts = urlparse(test.url)
                hostname = urlParts.hostname
                myTestTargets.append(hostname)

        for target in self.targets:
            actual_count = 0
            needed_count = 1

            if target.startswith("*."):
                needed_count = 3

            if target.endswith(".*"):
                needed_count = 10

            # non-wildcard target always have a implicit test url, if is it not excluded
            if not "*" in target and not self.excludes(("http://{}/".format(target))):
                continue

            # According to the logic in rules.js available at
            # EFForg/https-everywhere/blob/07fe9bd51456cc963c2d99e327f3183e032374ee/chromium/rules.js#L404
            #
            pattern = target.replace('.', '\.')  # .replace('*', '.+')

            # `*.example.com` matches `bar.example.com` and `foo.bar.example.com` etc.
            if pattern[0] == '*':
                pattern = pattern.replace('*', '.+')

            # however, `example.*` match `example.com` but not `example.co.uk`
            if pattern[-1] == '*':
                pattern = pattern.replace('*', '[^\.]+')

            # `www.*.example.com` match `www.image.example.com` but not `www.ssl.image.example.com`
            pattern = pattern.replace('*', '[^\.]+')

            pattern = '^' + pattern + '$'

            for test in myTestTargets:
                if regex.search(pattern, test) is not None:
                    actual_count += 1

                    if not actual_count < needed_count:
                        break

            if actual_count < needed_count:
                problems.append("{}: Not enough tests ({} vs {}) for {}".format(
                    self.filename, actual_count, needed_count, target))

        # Next, make sure each rule or exclusion has sufficient tests.
        for rule in self.rules:
            needed_count = 1 + len(regex.findall("[+*?|]", rule.fromPattern))
            # Don't treat the question mark in non-capturing and lookahead groups as increasing the
            # number of required tests.
            needed_count = needed_count - \
                len(regex.findall("\(\?:", rule.fromPattern))
            needed_count = needed_count - \
                len(regex.findall("\(\?!", rule.fromPattern))
            needed_count = needed_count - \
                len(regex.findall("\(\?=", rule.fromPattern))
            # Don't treat escaped questions marks as increasing the number of required
            # tests.
            needed_count = needed_count - \
                len(regex.findall("\\?", rule.fromPattern))
            actual_count = len(rule.tests)
            if actual_count < needed_count:
                problems.append("{}: Not enough tests ({} vs {}) for {}".format(
                    self.filename, actual_count, needed_count, rule))
                pass
        for exclusion in self.exclusions:
            needed_count = 1 + \
                len(regex.findall("[+*?|]", exclusion.exclusionPattern))
            needed_count = needed_count - \
                len(regex.findall("\(\?:", exclusion.exclusionPattern))
            needed_count = needed_count - \
                len(regex.findall("\\?", rule.fromPattern))
            actual_count = len(exclusion.tests)
            if actual_count < needed_count:
                problems.append("{}: Not enough tests ({} vs {}) for {}".format(
                    self.filename, actual_count, needed_count, exclusion))
        return problems

    def getNonmatchGroupProblems(self):
        """Verify that when rules are actually applied, no non-match groups (e.g.
                 '$1', '$2' etc.) will exist in the rewritten url"""
        self._determineTestApplication()
        problems = []
        for rule in self.rules:
            test_urls = [test.url for test in rule.tests]
            for test in rule.tests:
                try:
                    replacement_url = rule.apply(test.url)
                except Exception as e:
                    if ~e.message.index("invalid group reference"):
                        problems.append("{}: Rules include non-matched groups in replacement for url: {}".format(
                            self.filename, test.url))
        return problems

    def getTestFormattingProblems(self):
        """Verify that tests are formatted properly.  This ensures that no test url
                will lack a '/' in the path."""
        problems = []
        for rule in self.rules:
            for test in rule.tests:
                parsed_url = urlparse(test.url)
                if parsed_url.path == '':
                    problems.append("{}: Test url lacks a trailing /: {}".format(
                        self.filename, test.url))
        return problems

    def whatApplies(self, url):
        for exclusion in self.exclusions:
            if exclusion.matches(url):
                return exclusion
        for rule in self.rules:
            if rule.matches(url):
                return rule

    def __repr__(self):
        return "<Ruleset(name={}, platform={})>".format(repr(self.name), repr(self.platform))

    def __str__(self):
        return self.__repr__()

    def __eq__(self, other):
        """We consider name to be unique identifier."""
        return self.name == other.name

    def __hash__(self):
        return hash(self.name)
