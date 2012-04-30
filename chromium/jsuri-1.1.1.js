/*!
 * jsUri v1.1.1
 * https://github.com/derek-watson/jsUri
 *
 * Copyright 2011, Derek Watson
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * Includes parseUri regular expressions
 * http://blog.stevenlevithan.com/archives/parseuri
 * Copyright 2007, Steven Levithan
 * Released under the MIT license.
 *
 * Date: Mon Nov 14 20:06:34 2011 -0800
 */
    

var Query = function (queryString) {

    // query string parsing, parameter manipulation and stringification

    'use strict';

    var // parseQuery(q) parses the uri query string and returns a multi-dimensional array of the components
        parseQuery = function (q) {
            var arr = [], i, ps, p, keyval;

            if (typeof (q) === 'undefined' || q === null || q === '') {
                return arr;
            }

            if (q.indexOf('?') === 0) {
                q = q.substring(1);
            }

            ps = q.toString().split(/[&;]/);

            for (i = 0; i < ps.length; i++) {
                p = ps[i];
                keyval = p.split('=');
                arr.push([keyval[0], keyval[1]]);
            }

            return arr;
        },

        params = parseQuery(queryString),

        // toString() returns a string representation of the internal state of the object
        toString = function () {
            var s = '', i, param;
            for (i = 0; i < params.length; i++) {
                param = params[i];
                if (s.length > 0) {
                    s += '&';
                }
                s += param.join('=');
            }
            return s.length > 0 ? '?' + s : s;
        },

        decode = function (s) {
            s = decodeURIComponent(s);
            s = s.replace('+', ' ');
            return s;
        },

        // getParamValues(key) returns the first query param value found for the key 'key'
        getParamValue = function (key) {
            var param, i;
            for (i = 0; i < params.length; i++) {
                param = params[i];
                if (decode(key) === decode(param[0])) {
                    return param[1];
                }
            }
        },

        // getParamValues(key) returns an array of query param values for the key 'key'
        getParamValues = function (key) {
            var arr = [], i, param;
            for (i = 0; i < params.length; i++) {
                param = params[i];
                if (decode(key) === decode(param[0])) {
                    arr.push(param[1]);
                }
            }
            return arr;
        },

        // deleteParam(key) removes all instances of parameters named (key)
        // deleteParam(key, val) removes all instances where the value matches (val)
        deleteParam = function (key, val) {

            var arr = [], i, param, keyMatchesFilter, valMatchesFilter;

            for (i = 0; i < params.length; i++) {

                param = params[i];
                keyMatchesFilter = decode(param[0]) === decode(key);
                valMatchesFilter = decode(param[1]) === decode(val);

                if ((arguments.length === 1 && !keyMatchesFilter) || (arguments.length === 2 && !keyMatchesFilter && !valMatchesFilter)) {
                    arr.push(param);
                }
            }

            params = arr;

            return this;
        },

        // addParam(key, val) Adds an element to the end of the list of query parameters
        // addParam(key, val, index) adds the param at the specified position (index)
        addParam = function (key, val, index) {

            if (arguments.length === 3 && index !== -1) {
                index = Math.min(index, params.length);
                params.splice(index, 0, [key, val]);
            } else if (arguments.length > 0) {
                params.push([key, val]);
            }
            return this;
        },

        // replaceParam(key, newVal) deletes all instances of params named (key) and replaces them with the new single value
        // replaceParam(key, newVal, oldVal) deletes only instances of params named (key) with the value (val) and replaces them with the new single value
        // this function attempts to preserve query param ordering
        replaceParam = function (key, newVal, oldVal) {

            var index = -1, i, param;

            if (arguments.length === 3) {
                for (i = 0; i < params.length; i++) {
                    param = params[i];
                    if (decode(param[0]) === decode(key) && decodeURIComponent(param[1]) === decode(oldVal)) {
                        index = i;
                        break;
                    }
                }
                deleteParam(key, oldVal).addParam(key, newVal, index);
            } else {
                for (i = 0; i < params.length; i++) {
                    param = params[i];
                    if (decode(param[0]) === decode(key)) {
                        index = i;
                        break;
                    }
                }
                deleteParam(key);
                addParam(key, newVal, index);
            }
            return this;
        };

    // public api
    return {
        getParamValue: getParamValue,
        getParamValues: getParamValues,
        deleteParam: deleteParam,
        addParam: addParam,
        replaceParam: replaceParam,
        
        toString: toString
    };
};

var Uri = function (uriString) {

    // uri string parsing, attribute manipulation and stringification

    'use strict';

    /*global Query: true */
    /*jslint regexp: false, plusplus: false */

    var strictMode = false,

        // parseUri(str) parses the supplied uri and returns an object containing its components
        parseUri = function (str) {

            /*jslint unparam: true */
            var parsers = {
                    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                    loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
                },
                keys = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"],
                q = {
                    name: "queryKey",
                    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
                },
                m = parsers[strictMode ? "strict" : "loose"].exec(str),
                uri = {},
                i = 14;

            while (i--) {
                uri[keys[i]] = m[i] || "";
            }

            uri[q.name] = {};
            uri[keys[12]].replace(q.parser, function ($0, $1, $2) {
                if ($1) {
                    uri[q.name][$1] = $2;
                }
            });

            return uri;
        },

        uriParts = parseUri(uriString || ''),

        queryObj = new Query(uriParts.query),


        /*
            Basic get/set functions for all properties
        */

        protocol = function (val) {
            if (typeof val !== 'undefined') {
                uriParts.protocol = val;
            }
            return uriParts.protocol;
        },

        hasAuthorityPrefixUserPref = null,

        // hasAuthorityPrefix: if there is no protocol, the leading // can be enabled or disabled
        hasAuthorityPrefix = function (val) {

            if (typeof val !== 'undefined') {
                hasAuthorityPrefixUserPref = val;
            }

            if (hasAuthorityPrefixUserPref === null) {
                return (uriParts.source.indexOf('//') !== -1);
            } else {
                return hasAuthorityPrefixUserPref;
            }
        },

        userInfo = function (val) {
            if (typeof val !== 'undefined') {
                uriParts.userInfo = val;
            }
            return uriParts.userInfo;
        },

        host = function (val) {
            if (typeof val !== 'undefined') {
                uriParts.host = val;
            }
            return uriParts.host;
        },

        port = function (val) {
            if (typeof val !== 'undefined') {
                uriParts.port = val;
            }
            return uriParts.port;
        },

        path = function (val) {
            if (typeof val !== 'undefined') {
                uriParts.path = val;
            }
            return uriParts.path;
        },

        query = function (val) {
            if (typeof val !== 'undefined') {
                queryObj = new Query(val);
            }
            return queryObj;
        },

        anchor = function (val) {
            if (typeof val !== 'undefined') {
                uriParts.anchor = val;
            }
            return uriParts.anchor;
        },


        /*
            Fluent setters for Uri uri properties
        */

        setProtocol = function (val) {
            protocol(val);
            return this;
        },

        setHasAuthorityPrefix = function (val) {
            hasAuthorityPrefix(val);
            return this;
        },

        setUserInfo = function (val) {
            userInfo(val);
            return this;
        },

        setHost = function (val) {
            host(val);
            return this;
        },

        setPort = function (val) {
            port(val);
            return this;
        },

        setPath = function (val) {
            path(val);
            return this;
        },

        setQuery = function (val) {
            query(val);
            return this;
        },

        setAnchor = function (val) {
            anchor(val);
            return this;
        },

        /*
            Query method wrappers
        */
        getQueryParamValue = function (key) {
            return query().getParamValue(key);
        },

        getQueryParamValues = function (key) {
            return query().getParamValues(key);
        },

        deleteQueryParam = function (key, val) {
            if (arguments.length === 2) {
                query().deleteParam(key, val);
            } else {
                query().deleteParam(key);
            }

            return this;
        },

        addQueryParam = function (key, val, index) {
            if (arguments.length === 3) {
                query().addParam(key, val, index);
            } else {
                query().addParam(key, val);
            }
            return this;
        },

        replaceQueryParam = function (key, newVal, oldVal) {
            if (arguments.length === 3) {
                query().replaceParam(key, newVal, oldVal);
            } else {
                query().replaceParam(key, newVal);
            }

            return this;
        },

        /*
            Serialization
        */

        // toString() stringifies the current state of the uri
        toString = function () {

            var s = '',
                is = function (s) {
                    return (s !== null && s !== '');
                };

            if (is(protocol())) {
                s += protocol();
                if (protocol().indexOf(':') !== protocol().length - 1) {
                    s += ':';
                }
                s += '//';
            } else {
                if (hasAuthorityPrefix() && is(host())) {
                    s += '//';
                }
            }

            if (is(userInfo()) && is(host())) {
                s += userInfo();
                if (userInfo().indexOf('@') !== userInfo().length - 1) {
                    s += '@';
                }
            }

            if (is(host())) {
                s += host();
                if (is(port())) {
                    s += ':' + port();
                }
            }

            if (is(path())) {
                s += path();
            } else {
                if (is(host()) && (is(query().toString()) || is(anchor()))) {
                    s += '/';
                }
            }
            if (is(query().toString())) {
                if (query().toString().indexOf('?') !== 0) {
                    s += '?';
                }
                s += query().toString();
            }

            if (is(anchor())) {
                if (anchor().indexOf('#') !== 0) {
                    s += '#';
                }
                s += anchor();
            }

            return s;
        },

        /*
            Cloning
        */

        // clone() returns a new, identical Uri instance
        clone = function () {
            return new Uri(toString());
        };

    // public api
    return {

        protocol: protocol,
        hasAuthorityPrefix: hasAuthorityPrefix,
        userInfo: userInfo,
        host: host,
        port: port,
        path: path,
        query: query,
        anchor: anchor,
        
        setProtocol: setProtocol,
        setHasAuthorityPrefix: setHasAuthorityPrefix,
        setUserInfo: setUserInfo,
        setHost: setHost,
        setPort: setPort,
        setPath: setPath,
        setQuery: setQuery,
        setAnchor: setAnchor,
        
        getQueryParamValue: getQueryParamValue,
        getQueryParamValues: getQueryParamValues,
        deleteQueryParam: deleteQueryParam,
        addQueryParam: addQueryParam,
        replaceQueryParam: replaceQueryParam,
        
        toString: toString,
        clone: clone
    };
};

/* add compatibility for users of jsUri <= 1.1.1 */
var jsUri = Uri;
