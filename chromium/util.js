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
console.log("Type this into the console: DEFAULT_LOG_LEVEL=VERB");
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

/**
 * Load a file packaged with the extension
 *
 * @param url: a relative URL to local file
 */
function loadExtensionFile(url, returnType) {
  var xhr = new XMLHttpRequest();
  // Use blocking XHR to ensure everything is loaded by the time
  // we return.
  xhr.open("GET", chrome.extension.getURL(url), false);
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

Object.assign(exports, {
  VERB,
  DBUG,
  INFO,
  NOTE,
  WARN,
  log,
  loadExtensionFile
});

})(typeof exports == 'undefined' ? require.scopes.util = {} : exports);
