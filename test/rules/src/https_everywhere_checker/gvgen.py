#!/usr/bin/env python3.6
# -*- coding: utf-8 -*-
# $Id: gvgen.py 10440 2007-10-23 15:17:33Z toady $
"""
GvGen - Generate dot file to be processed by graphviz
Copyright (c) 2007 INL
Written by Sebastien Tricaud <sebastien.tricaud@inl.fr>

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 2 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.

2007/11/17: cleaned a bit and retabbed to match gentoo's portage code
guidelines. This gvgen.py comes from gvgen-0.6.
Ondrej Mikle

"""

from sys import stdout

debug = 0


class GvGen:
    """
    Graphviz dot language Generation Class
    For example of usage, please see the __main__ function
    """
    __id = 0
    __edges = []
    __browse_level = 0					# Stupid depth level for self.browse
    __opened_braces = []				# We count opened clusters
    fd = stdout							# File descriptor to output dot
    padding_str = "	"					# Left padding to make children and parent look nice
    __styles = {}
    __default_style = []
    options = None

    def __init__(self, options=None):
        self.max_line_width = 10
        self.max_arrow_width = 2
        self.line_factor = 1
        self.arrow_factor = 0.5

        self.options = options

    def __edge_new(self, name, parent=None, distinct=None):
        """
        Create a new edge in the data structure
        @name: Name of the edge, that will be the graphviz label
        @parent: The edge parent id
        @distinct: if true, will not create and edge that has the same name

        Returns: The edge id created
        """

        # We first check for distincts
        if distinct:
            if self.__edges:
                for e in self.__edges:
                    props = e['properties']
                    if props['label'] == name:
                        # We found the label name matching, we return -1
                        return -1

        # We now insert into gvgen datastructure
        self.__id += 1
        edge = {'id': self.__id,		# Internal ID
                'lock': 0,				# When the edge is written, it is locked to avoid further references
                'parent': parent,		# Edge parent for easy graphviz clusters
                'to': [],				# Every node where this node points to
                'style': None,			# Style that GvGen allow you to create
                'properties': {			# Custom graphviz properties you can add, which will overide previously defined styles
                    'label': name
                }
                }

        self.__edges.append(edge)
        return self.__id

    def __has_children(self, eid):
        """
        Find children to a given parent id
        Returns the children list
        """
        children_list = []
        for e in self.__edges:
            if e['parent'] == eid:
                children_list.append(e['id'])

        return children_list

    def getEdge(self, eid):
        """
        Returns the edge data
        """
        for e in self.__edges:
            if e['id'] == eid:
                return e

    def newItem(self, name, parent=None, distinct=None):
        edge = self.__edge_new(name, parent, distinct)

        return edge

    def newLink(self, src, dst, label=None):
        """
        Link two existing edges with each other
        """
        try:
            s = self.getEdge(src)
            try:
                d = self.getEdge(dst)
                s['to'].append(d['id'])
            except:
                print("/* (newLink): Cannot get the destination edge */")

        except:
            print("/* (newLink): Cannot get the source edge */")

    def debug(self):
        for e in self.__edges:
            print("element = " + str(e))

    def collectLeaves(self, parentid):
        """
        Collect every leaf sharing the same parent
        """
        cl = []
        for e in self.__edges:
            if e['parent'] == parentid:
                cl.append(e['id'])

        return cl

    def collectUnlockedLeaves(self, parentid):
        """
        Collect every leaf sharing the same parent
        unless it is locked
        """
        cl = []
        for e in self.__edges:
            if e['parent'] == parentid:
                if not e['lock']:
                    cl.append(e['id'])

        return cl

    def lockEdge(self, eid):
        e = self.getEdge(eid)
        e['lock'] = 1

    #
    # Start: styles management
    #
    def styleAppend(self, stylename, key, val):
        if stylename not in self.__styles:
            self.__styles[stylename] = []

        self.__styles[stylename].append([key, val])

    def styleApply(self, stylename, eid):
        e = self.getEdge(eid)
        e['style'] = stylename

    def styleDefaultAppend(self, key, val):
        self.__default_style.append([key, val])

    #
    # End: styles management
    #

    #
    # Start: properties management
    #
    def propertiesAsStringGet(self, eid, props):
        """
        Get the properties string according to parent/children
        props is the properties dictionnary
        """

        properties = ""
        applied_style = 0

        #
        # Default style come first, they can then be overriden
        #
        if self.__default_style:
            e = self.getEdge(eid)
            if self.__has_children(eid):
                for s in self.__default_style:
                    properties += "{}=\"{}\";\n".format(str(s[0]), str(s[1]))
            else:
                # Build the properties string for edge
                applied_style = 1
                properties = "["
                for s in self.__default_style:
                    properties += "{}=\"{}\",".format(str(s[0]), str(s[1]))
                if not props:
                    properties = properties[:-1]
                    properties += "]"

        #
        # First, we build the styles
        #
        e = self.getEdge(eid)
        if e['style']:
            stylename = e['style']

            if self.__has_children(eid):
                for s in self.__styles[stylename]:
                    properties += "{}=\"{}\";\n".format(str(s[0]), str(s[1]))
            else:
                # Build the properties string for edge
                applied_style = 1
                properties = "["
                for s in self.__styles[stylename]:
                    properties += "{}=\"{}\",".format(str(s[0]), str(s[1]))
                if not props:
                    properties = properties[:-1]
                    properties += "]"

        #
        # Now we build the properties:
        # remember they override styles
        #
        if self.__has_children(eid):
            if props:
                for k in props.keys():
                    val = props[k]
                    properties += "{}=\"{}\";\n".format(str(k), str(val))
        else:
            # Build the properties string for edge
            if props:
                if not applied_style:
                    properties = "["
                for k in props.keys():
                    val = props[k]
                    properties += "{}=\"{}\",".format(str(k), str(val))
                # We delete the last ','
                properties = properties[:-1]
                properties += "]"

        return properties

    def propertyAppend(self, eid, key, val):
        """
        Append a property to the wanted edge
        myedge = newItem(\"blah\")
        Ex. propertyAppend(myedge, \"color\", \"red\")
        """
        e = self.getEdge(eid)
        props = e['properties']
        props[key] = val

    #
    # End: Properties management
    #

    def tree_debug(self, level, eid, children):
        if children:
            print("(level:{}) Eid:{} has children ({})".format(
                level, eid, str(children)))
        else:
            print("Eid:"+str(eid)+" has no children")

    def tree(self, level, eid, children):
        """
        Core function to output dot which sorts out parents and children
        and do it in the right order
        """
        e = self.getEdge(eid)
        if debug:
            print("/* Grabed edge = {}*/".format(str(e)))

        if e['lock'] == 1:			  # The edge is locked, nothing should be printed
            return

        props = e['properties']

        e['lock'] = 1

        if children:
            self.fd.write(level * self.padding_str)
            self.fd.write(self.padding_str + "subgraph cluster{} {\n".format(eid))
            properties = self.propertiesAsStringGet(eid, props)
            self.fd.write(level * self.padding_str)
            self.fd.write(self.padding_str + "{}".format(properties))
            self.__opened_braces.append([eid, level])
        else:

            # We grab appropriate properties
            properties = self.propertiesAsStringGet(eid, props)

            # We get the latest opened elements
            if self.__opened_braces:
                last_cluster, last_level = self.__opened_braces[-1]
            else:
                last_cluster = 0
                last_level = 0

            if debug:
                print("/* e[parent] = {}, last_cluster = {}, last_level = {}, opened_braces: {} */".format(
                    str(e['parent']), last_cluster, last_level, str(self.__opened_braces)))

            # Write children/parent with properties
            if e['parent']:
                if e['parent'] != last_cluster:
                    while e['parent'] < last_cluster:
                        last_cluster, last_level = self.__opened_braces[-1]
                        if e['parent'] == last_cluster:
                            last_level += 1
                            # We browse any property to build a string
                            self.fd.write(last_level * self.padding_str)
                            self.fd.write(self.padding_str +
                                          "edge{} {};\n".format(eid, properties))
                        else:
                            self.fd.write(last_level * self.padding_str)
                            self.fd.write(self.padding_str + "}\n")
                            self.__opened_braces.pop()
                else:
                    self.fd.write(level * self.padding_str)
                    self.fd.write(self.padding_str + "edge{} {};\n".format(eid, properties))
                    cl = self.collectUnlockedLeaves(e['parent'])
                    for leaf in cl:
                        l = self.getEdge(leaf)
                        props = l['properties']
                        properties = self.propertiesAsStringGet(leaf, props)
                        self.fd.write(last_level * self.padding_str)
                        self.fd.write(
                            self.padding_str + self.padding_str + "edge{} {};\n".format(leaf, properties))
                        self.lockEdge(leaf)

                    self.fd.write(level * self.padding_str + "}\n")
                    self.__opened_braces.pop()
            else:
                self.fd.write(self.padding_str + "edge{} {};\n".format(eid, properties))

    def browse(self, eid, cb):
        """
        Browse edges in a tree and calls cb providing edge parameters
        """
        children = self.__has_children(eid)
        if children:
            cb(self.__browse_level, eid, str(children))
            for c in children:
                self.__browse_level += 1
                self.browse(c, cb)

        else:
            cb(self.__browse_level, eid, None)
            self.__browse_level = 0

    # We write the links between nodes
    def dotLinks(self, eid):

        e = self.getEdge(eid)

        for to in e['to']:
            # We cannot link from a cluster
            children = self.__has_children(eid)
            if children:
                raise Exception("Cannot link from a parent")

            children = self.__has_children(to)
            if children:
                raise Exception("Cannot link to a parent")
            self.fd.write("edge{}->edge{};\n".format(eid, to))

    def dot(self, fd=stdout):
        """
        Translates the datastructure into dot
        """
        try:
            self.fd = fd

            self.fd.write("digraph G {\n")

            if self.options:
                self.fd.write(self.options+"\n")

            # We write parents and children in order
            for e in self.__edges:
                self.browse(e['id'], self.tree)

            # We write the connection between nodes
            for e in self.__edges:
                self.dotLinks(e['id'])

            # We put all the nodes belonging to the parent
            self.fd.write("}\n")
        finally:
            # Remove our reference to file descriptor
            self.fd = None

    #
    # Begin: Backward API compatibility (with gvglue)
    #
    def properties_style_add(self, stylename, key, val):
        print("/* Warning, use of deprecated function (properties_style_add). Please use 'styleAppend' now */")
        self.styleAppend(stylename, key, val)

    def properties_style_apply(self, stylename, eid):
        print("/* Warning, use of deprecated function (properties_style_apply). Please use 'styleApply' now */")
        self.styleApply(stylename, eid)

    def finish(self, fd=stdout):
        print("/* Warning, use of deprecated function (finish). Please use 'dot' now */")
        self.dot(fd)


if __name__ == "__main__":
    graph = GvGen()

    graph.styleDefaultAppend("color", "blue")

    parents = graph.newItem("Parents")
    father = graph.newItem("Bob", parents)
    mother = graph.newItem("Alice", parents)
    children = graph.newItem("Children")
    child1 = graph.newItem("Carol", children)
    child2 = graph.newItem("Eve", children)
    child3 = graph.newItem("Isaac", children)
    postman = graph.newItem("Postman")
    graph.newLink(father, child1)
    graph.newLink(father, child2)
    graph.newLink(mother, child2)
    graph.newLink(mother, child1)
    graph.newLink(mother, child3)
    graph.newLink(postman, child3)

    graph.propertyAppend(postman, "color", "red")
    graph.propertyAppend(postman, "fontcolor", "white")

    graph.styleAppend("Post", "color", "blue")
    graph.styleAppend("Post", "style", "filled")
    graph.styleAppend("Post", "shape", "rectangle")
    graph.styleApply("Post", postman)

    graph.dot()
