# Metrics for measuring similarity of two strings, HTML/XML DOM trees, etc.
# They are not (yet) guarranteed to be "proper metrics" in calculus sense.

from lxml import etree
from io import StringIO

import struct
import bsdiff4 as bsdiff
import Levenshtein


class Metric(object):
    """Abstract interface for Metric objects."""

    def __init__(self):
        pass

    def distanceNormed(self, s1, s2):
        """Return float distance metric of two strings s1 and s2 in
        range [0, 1].
        """
        raise NotImlementedError()


class BSDiffMetric(Metric):
    """String similarity metric based on BSDiff."""

    def __init__(self):
        Metric.__init__(self)

    def distanceNormed(self, s1, s2):
        if len(s1) == 0 and len(s2) == 0:
            return 0

        # bsdiff is not symmetric, so take max from both diffs
        control, diffBlock, extra = bsdiff.Diff(s1, s2)
        extraRatio1 = float(len(extra))/float(max(len(s1), len(s2)))

        control, diffBlock, extra = bsdiff.Diff(s2, s1)
        extraRatio2 = float(len(extra))/float(max(len(s1), len(s2)))

        return max(extraRatio1, extraRatio2)


class MarkupMetric(Metric):
    """Metric for tree-like hierarchical languages - XML, HTML."""

    def __init__(self):
        Metric.__init__(self)

    def tagNameToCharMap(self, doc1, doc2, minIndex=0):
        """Returns a dict that maps element names to unicode characters uniquely.

        @param doc1: html/xml tree string as lxml Element or ElementTree
        @param doc2: html/xml tree string as lxml Element or ElementTree
        @param minIndex: start numbering with this unicode value
        """
        tags = set((elem.tag for elem in doc1.xpath("//*")))
        tags.update((elem.tag for elem in doc2.xpath("//*")))

        # Number them consistently among those two documents.
        # Hackish way to map custom alphabet onto unicode chars, but works for
        # up to >= 55000 element names which should be more than enough.
        unicodeAlphabet = (struct.pack("<H", index).decode('utf-16')
                           for index in range(minIndex, minIndex+len(tags)))
        numberedTags = zip(tags, unicodeAlphabet)

        return dict(numberedTags)

    def mapTree(self, elem, tagToCharMap):
        """Map element to unicode character. If it has no children, it'll be mapped
        to a single char, otherwise mapped as "(X + Y + Z)" where X, Y, Z is
        mapping of its children (+ is concatenation).

        @param elem: lxml Element
        @param tagToCharMap: dict from tag name to unicode char
        """
        # this isinstance test is in lxml tutorial, dunno how else to skip comments
        children = [child for child in list(
            elem) if isinstance(child.tag, str)]
        thisElem = tagToCharMap[elem.tag]

        if children:
            childrenMap = [self.mapTree(child, tagToCharMap)
                           for child in children]
            return thisElem + '(' + "".join(childrenMap) + ')'
        else:
            return thisElem

    def mappedTrees(self, doc1, doc2):
        """Returns unicode string that represents the tree structure of
        the HTML/XML documents. Only tag names are considered.

        @returns: tuple of two unicode strings
        """
        # The 42 is first char after parentheses in unicode encoding
        tagToCharMap = self.tagNameToCharMap(doc1, doc2, 42)

        return (self.mapTree(doc1, tagToCharMap), self.mapTree(doc2, tagToCharMap))

    def distanceNormed(self, s1, s2):
        """
        """
        # Empty strings are not proper HTML/XML, but we can consider them
        # same for our purpose.
        if len(s1) == 0 and len(s2) == 0:
            return 0
        if s1 == s2:
            return 0

        try:
            doc1 = etree.parse(StringIO(s1), etree.HTMLParser())
            doc2 = etree.parse(StringIO(s2), etree.HTMLParser())
        except:
            # Some documents don't parse as XML. In that case, punt and return 0
            # distance.
            return 0

        # If we failed to parse either document, return max Levenshtein distance.
        # Note this will happen for non-HTML documents like favicons.
        # Identical documents should hit the equality check before parsing.
        if not doc1 or not doc2 or doc1.getroot() is None or doc2.getroot() is None:
            return 1

        mapped1, mapped2 = self.mappedTrees(doc1.getroot(), doc2.getroot())

        return 1.0-Levenshtein.ratio(mapped1, mapped2)
