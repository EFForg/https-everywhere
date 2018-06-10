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
 * @return {Promise}: a Promise which resolve to file content/ parsed object
 */
async function loadExtensionFile(url, returnType) {
  return fetch(url).then(response => {
    if (returnType === 'json') {
      return response.json();
    } else if (returnType === 'xml') {
      return response.text().then(text => {
        return (new DOMParser()).parseFromString(text);
      });
    } else {
      return response.text();
    }
  })
}

/**
 * Convert an ArrayBuffer to string
 *
 * @param array: an ArrayBuffer to convert
 */
function ArrayBufferToString(ab) {
  let array = new Uint8Array(ab);
  let string = "";

  for (let byte of array){
    string += String.fromCharCode(byte);
  }

  return string;
}


Object.assign(exports, {
  VERB,
  DBUG,
  INFO,
  NOTE,
  WARN,
  log,
  setDefaultLogLevel,
  getDefaultLogLevel,
  loadExtensionFile,
  ArrayBufferToString
});

})(typeof exports == 'undefined' ? require.scopes.util = {} : exports);
