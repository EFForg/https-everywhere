"use strict";

(function(exports) {

var VERB = 1;
var DBUG = 2;
var INFO = 3;
var NOTE = 4;
var WARN = 5;
// FYI: Logging everything is /very/ slow. Chrome will log & buffer
// these console logs even when the debug tools are closed. :(

// TODO: Add an easy UI to change the log level.
// (Developers can just type DEFAULT_LOG_LEVEL=VERB in the console)
var DEFAULT_LOG_LEVEL = NOTE;
console.log("Hey developer! Want to see more verbose logging?");
console.log("Type this into the console: let util = require('./util'); util.setDefaultLogLevel(util.VERB);");
console.log("Accepted levels are VERB, DBUG, INFO, NOTE and WARN, default is NOTE");

function log(level, str) {
  if (level >= DEFAULT_LOG_LEVEL) {
    if (level === WARN) {
      // Show warning with a little yellow icon in Chrome.
      console.warn(str);
    } else {
      console.log(str);
    }
  }
}

function setDefaultLogLevel(level) {
  DEFAULT_LOG_LEVEL = level;
}

function getDefaultLogLevel() {
  return DEFAULT_LOG_LEVEL;
}

/**
 * Load a file packaged with the extension
 *
 * @param url: a relative URL to local file
 */
function loadExtensionFile(url, returnType) {
  var xhr = new XMLHttpRequest();
  // Use blocking XHR to ensure everything is loaded by the time
  // we return.
  xhr.open("GET", chrome.runtime.getURL(url), false);
  xhr.send(null);
  // Get file contents
  if (xhr.readyState !== 4) {
    return;
  }
  if (returnType === 'xml') {
    return xhr.responseXML;
  }
  if (returnType === 'json') {
    return JSON.parse(xhr.responseText);
  }
  return xhr.responseText;
}

/**
 * Remove tailing dots from hostname, e.g. "www.example.com."
 * Preserve port numbers if they are used
 */
function getNormalisedHostname(host) {
  let [ hostname, port ] = host.split(":");
  while (hostname && hostname[hostname.length - 1] === '.' && hostname !== '.') {
    hostname = hostname.slice(0, -1);
  }
  if (port) {
    return `${hostname}:${port}`;
  }
  return hostname;
}

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
 * Return true if host is well-formed (RFC 1035)
 */
function isValidHostname(host) {
  if (host && host.length > 0 && host.length <= 255 && host.indexOf("..") === -1) {
    return true;
  }
  return false;
}

/**
 * Return a list of wildcard expressions which support
 * the host under HTTPS Everywhere's implementation
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

/**
 * Convert an ArrayBuffer to string
 *
 * @param array: an ArrayBuffer to convert
 */
function ArrayBufferToString(ab) {
  let array = new Uint8Array(ab);
  let string = "";

  for (let byte of array) {
    string += String.fromCharCode(byte);
  }

  return string;
}

/**
 * Convert a string to an ArrayBuffer
 *
 * @param string: a string to convert
 */
function StringToArrayBuffer(str) {
  var byteArray = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) {
    byteArray[i] = str.charCodeAt(i);
  }
  return byteArray;
}


Object.assign(exports, {
  VERB,
  DBUG,
  INFO,
  NOTE,
  WARN,
  log,
  nullIterable,
  isValidHostname,
  getNormalisedHostname,
  getWildcardExpressions,
  setDefaultLogLevel,
  getDefaultLogLevel,
  loadExtensionFile,
  ArrayBufferToString,
  StringToArrayBuffer
});

})(typeof exports == 'undefined' ? require.scopes.util = {} : exports);
