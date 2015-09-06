"use strict";

var VERB=1;
var DBUG=2;
var INFO=3;
var NOTE=4;
var WARN=5;
// FYI: Logging everything is /very/ slow. Chrome will log & buffer
// these console logs even when the debug tools are closed. :(

// TODO: Add an easy UI to change the log level.
// (Developers can just type DEFAULT_LOG_LEVEL=1 in the console)
var DEFAULT_LOG_LEVEL=4;
console.log("Hey developer! Want to see more verbose logging?");
console.log("Type this into the console: DEFAULT_LOG_LEVEL=1");

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
