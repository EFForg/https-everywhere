"use strict";

/**
 * @module Host Validation
 * @description alidations for hosts and other data that get parsed by background scripts
 */

(function (exports) {

// Empty iterable singleton to reduce memory usage
const nullIterable = Object.create(null, {
  [Symbol.iterator]: {
    value: function* () {
      // do nothing
    }
  },

  size: {
    value: 0
  },
});

/**
 * @description Remove tailing dots from hostname, e.g. "www.example.com."
 * @param {string} hostname
 */
function getNormalisedHostname(hostname) {
  while (hostname && hostname[hostname.length - 1] === '.' && hostname !== '.') {
    hostname = hostname.slice(0, -1);
  }
  return hostname;
}

/**
 * @description Return true if host is well-formed
 * @see (RFC 1035)
 * @param {string} host
 */
function isValidHostname(host) {
  if (host && host.length > 0 && host.length <= 255 && host.indexOf("..") === -1) {
    return true;
  }
  return false;
}

/**
 * @description Return a list of wildcard expressions which support
 * the host under HTTPS Everywhere's implementation
 * @param {string} host
 * @see RFC 1035
 */
function getWildcardExpressions(host) {
  // Ensure host is well-formed (RFC 1035)
  if (!isValidHostname(host)) {
    return nullIterable;
  }

  // Ensure host does not contain a wildcard itself
  if (host.indexOf("*") != -1) {
    return nullIterable;
  }

  let results = [];

  // Replace www.example.com with www.example.*
  // eat away from the right for once and only once
  let segmented = host.split(".");
  if (segmented.length > 1) {
    const tmp = [...segmented.slice(0, segmented.length - 1), "*"].join(".");
    results.push(tmp);
  }

  // now eat away from the left, with *, so that for x.y.z.google.com we
  // check *.y.z.google.com, *.z.google.com and *.google.com
  for (let i = 1; i < segmented.length - 1; i++) {
    const tmp = ["*", ...segmented.slice(i, segmented.length)].join(".");
    results.push(tmp);
  }
  return results;
}

Object.assign(exports, {
  nullIterable,
  getNormalisedHostname,
  getWildcardExpressions,
  isValidHostname
});

})(typeof exports == 'undefined' ? require.scopes.validation = {} : exports);
