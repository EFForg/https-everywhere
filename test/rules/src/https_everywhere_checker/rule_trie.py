import urllib.parse
import os.path
from gvgen import GvGen

# Rule trie
#
# Rule trie is a suffix tree that resolves which rulesets should apply for a
# given FDQN. FQDN is first tranformed from potential IDN form into punycode
# ASCII. Every node in the tree has a list of rulesets that maps the part of
# FQDN between dots to list/set of rulesets.
#
# Children subdomains are mapped using dict.
#
#
#                               +--------+
#                           +---| root . |----+
#                           |   +--------+    |
#                           |                 |
#                           |                 |
#                           v                 v
#                        +-----+           +-----+
#                  +-----|  *  |     +-----| com |-----+
#                  |     +-----+     |     +-----+     |
#                  |                 |                 |
#                  v                 v                 v
#              +------+          +------+            +----+
#           +--|google|---+      |google|-+      +---|blee|---+
#           |  +------+   |      +------+ |      |   +----+   |
#           |     |       |       |       |      |     |      |
#           |     |       |       |       |      |     |      |
#           v     v       v       v       v      v     v      v
#         +---+ +---+ +----+    +---+   +---+  +---+ +----+ +---+
#         | * | |www| |docs|    | * |   |www|  |www| |www2| |ssl|
#         +---+ +---+ +----+    +---+   +---+  +---+ +----+ +---+
#
# At every node of the tree, there might be rulesets present. If a domain
# a.b.c is looked up, at every location of * the search is branched into
# multiple children - one with * and the other matching the domain part
# exactly.
#
# Assuming complexity of lookup in dict is O(1), lookup of FQDN consisting
# of N parts is O(N) if there are no * in the tree. Otherwise in theory
# it could be O(2^N), but the HTTPS Everywhere rules require only one *, so we
# still get O(N).


class RuleTransformError(ValueError):
    """Thrown when invalid scheme like file:/// is attempted to be
    transformed.
    """
    pass


class DomainNode(object):
    """Node of suffix trie for searching of applicable rulesets."""

    def __init__(self, subDomain, rulesets, depth):
        """Create instance for part of FQDN.
        @param subDomain: part of FQDN between "dots"
        @param rulesets: rules.Ruleset list that applies for this node in tree
        """
        self.subDomain = subDomain
        self.rulesets = rulesets
        self.children = {}  # map of subdomain to instance of DomainNode
        self.gvNode = None  # node for graphing with graphviz
        self.depth = depth  # depth in tree, root is at depth 0

    def addChild(self, subNode):
        """Add DomainNode for more-specific subdomains of this one."""
        self.children[subNode.subDomain] = subNode

    def matchingRulesets(self, domain):
        """Find matching rulesets for domain in this subtree.
        @param domain: domain to search for in this node's subtrees;
        empty string matches this node. Must not contain wildcards.
        @return: set of applicate rulesets
        """
        # we are the leaf that matched
        if domain == "":
            return self.rulesets

        applicableRules = set()

        # Wildcard node can expand to any number of subdomains per
        # HTE rulesets, if it's at least 3-rd level domain.
        # E.g. *.fbcdn.net target will also cover profile.ak.fbcdn.net
        #
        # See:
        #  https://gitweb.torproject.org/https-everywhere.git/commitdiff/6ca405d010062d2b2cb91b2024d4ebf7d405dee7
        #  https://www.eff.org/https-everywhere/rulesets (see also footnote)
        #
        # Currently there should be no targets with wildcard in the
        # middle in HTE rules, like bla.*.something.tld
        if self.depth >= 3 and self.subDomain == "*":
            applicableRules.update(self.rulesets)

        parts = domain.rsplit(".", 1)

        if len(parts) == 1:  # direct match on children
            childDomain = domain
            subLevelDomain = ""
        else:
            subLevelDomain, childDomain = parts

        wildcardChild = self.children.get("*")
        ruleChild = self.children.get(childDomain)

        # we need to consider direct matches as well as wildcard matches so
        # that match for things like "bla.google.*" work
        if ruleChild:
            applicableRules.update(ruleChild.matchingRulesets(subLevelDomain))
        if wildcardChild:
            applicableRules.update(
                wildcardChild.matchingRulesets(subLevelDomain))

        return applicableRules

    def prettyPrint(self, offset=0):
        """Pretty print for debugging"""
        print(" "*offset,)
        print(self)
        for child in self.children.values():
            child.prettyPrint(offset+3)

    def makeSubdomainEdge(self, graph, parent, child):
        """Make edge in graph of parent domain to child subdomain.
        GvGen nodes are created if not yet existing.

        @param graph: gvgen.GvGen object
        @param parent: parent DomainNode
        @param child: child DomainNode
        """
        if not child.gvNode:
            child.gvNode = graph.newItem(child.subDomain)
            graph.propertyAppend(child.gvNode, "shape", "octagon")
        if not parent.gvNode:
            # the "or" part so that root has some name
            parent.gvNode = graph.newItem(parent.subDomain or "<root>")
            graph.propertyAppend(parent.gvNode, "shape", "octagon")

        graph.newLink(parent.gvNode, child.gvNode)

    def generateGraphizGraph(self, graph):
        """Return tree as a GvGen object that can be output to dot file.

        @param graph: gvgen.GvGen object
        """
        for child in self.children.values():
            self.makeSubdomainEdge(graph, self, child)
            child.generateGraphizGraph(graph)

        for ruleset in self.rulesets:
            rulesetGvNode = graph.newItem(os.path.basename(ruleset.filename))
            graph.propertyAppend(rulesetGvNode, "shape", "rectangle")
            graph.propertyAppend(rulesetGvNode, "color", "green")
            graph.newLink(self.gvNode, rulesetGvNode)

    def __str__(self):
        return "<DomainNode for '{}', rulesets: {}>".format(self.subDomain, self.rulesets)

    def __repr__(self):
        return "<DomainNode for '{}>".format(self.subDomain,)


class RuleMatch(object):
    """Result of a rule match, contains transformed url and ruleset that
    matched (might be None if no match was found).
    """

    def __init__(self, url, ruleset):
        """Create instance that records url and ruleset that matched.

        @param url: transformed url after applying ruleset
        @param ruleset: ruleset that was used for the transform
        """
        self.url = url
        self.ruleset = ruleset


class RuleTrie(object):
    """Suffix trie for rulesets."""

    def __init__(self):
        self.root = DomainNode("", [], 0)

    def matchingRulesets(self, fqdn):
        """Return rulesets applicable for FQDN. Wildcards not allowed.
        """
        return self.root.matchingRulesets(fqdn)

    def addRuleset(self, ruleset):
        """Creates structure for given ruleset in the trie.
        @param ruleset: rules.Ruleset instance
        """
        for target in ruleset.targets:
            node = self.root
            # enumerate parts so we know when we hit leaf where
            # rulesets are to be stored
            parts = list(enumerate(target.split(".")))
            depth = 0

            for (idx, part) in reversed(parts):
                depth += 1
                partNode = node.children.get(part)

                # create node if not existing already and stuff
                # the rulesets in leaf
                if not partNode:
                    partNode = DomainNode(part, [], depth)
                    node.addChild(partNode)
                if idx == 0:
                    # there should be only one ruleset, but...
                    partNode.rulesets.append(ruleset)

                node = partNode

    def acceptedScheme(self, url):
        """Returns True iff the scheme in URL is accepted (http, https).
        """
        parsed = urllib.parse.urlparse(url)
        return parsed.scheme in ("http", "https")

    def transformUrl(self, url):
        """Look for rules applicable to URL and apply first one. If no
        ruleset matched, resulting RuleMatch object will have None set
        as the matching ruleset.

        @returns: RuleMatch with tranformed URL and ruleset that applied
        @throws: RuleTransformError if scheme is wrong (e.g. file:///)
        """
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise RuleTransformError("Unknown scheme '{}' in '{}'".format(parsed.scheme, url))

        fqdn = parsed.netloc.lower()
        matching = self.matchingRulesets(fqdn)

        for ruleset in matching:
            newUrl = ruleset.apply(url)
            if newUrl != url:
                return RuleMatch(newUrl, ruleset)
        return RuleMatch(url, None)

    def generateGraphizGraph(self):
        """Return graphviz graph of this trie.

        @return: gvgen.GvGen object
        """
        graph = GvGen()
        self.root.generateGraphizGraph(graph)
        return graph

    def prettyPrint(self):
        self.root.prettyPrint()
