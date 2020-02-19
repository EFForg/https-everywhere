"use strict";

/**
 * @module Log Utilities
 * @description logging functionality in console
 **/

(function (exports) {

let VERB = 1;
let DBUG = 2;
let INFO = 3;
let NOTE = 4;
let WARN = 5;

/**
 * FYI: Logging everything is /very/ slow. Chrome will log & buffer
 * these console logs even when the debug tools are closed. :(
 * @todo: Add an easy UI to change the log level.
 * Developers can just type DEFAULT_LOG_LEVEL=VERB in the console)
*/
// (
let DEFAULT_LOG_LEVEL = NOTE;
console.log("Hey developer! Want to see more verbose logging?");
console.log("Type this into the console: let util = require('./log'); util.setDefaultLogLevel(util.VERB);");
console.log("Accepted levels are VERB, DBUG, INFO, NOTE and WARN, default is NOTE");


/**
 * @description Logs with level given
 * @param {integer} level
 * @param {string} str
 */
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

/**
 * @description sets log level
 * @param {integer} level
 */
function setDefaultLogLevel(level) {
  DEFAULT_LOG_LEVEL = level;
}

/**
 * @description retrieves log level
 */
function getDefaultLogLevel() {
  return DEFAULT_LOG_LEVEL;
}

/**
 * @description Load a file packaged with the extension
 * @param {string} url: a relative URL to local file
 * @param {object} returnType
 */
function loadExtensionFile(url, returnType) {
  let xhr = new XMLHttpRequest();
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
 * @description Convert an ArrayBuffer to string
 * @param {array} ab an ArrayBuffer to convert
 */
function ArrayBufferToString(ab) {
  let array = new Uint8Array(ab);
  let string = "";

  for (let byte of array) {
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

})(typeof exports == 'undefined' ? require.scopes.log = {} : exports);
