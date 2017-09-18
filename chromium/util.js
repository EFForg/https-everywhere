export const VERB = 1;
export const DBUG = 2;
export const INFO = 3;
export const NOTE = 4;
export const WARN = 5;

// FYI: Logging everything is /very/ slow. Chrome will log & buffer
// these console logs even when the debug tools are closed. :(

// TODO: Add an easy UI to change the log level.
// (Developers can just type DEFAULT_LOG_LEVEL=VERB in the console)

window.DEFAULT_LOG_LEVEL = NOTE;

console.log("Hey developer! Want to see more verbose logging?");
console.log("Type this into the console: DEFAULT_LOG_LEVEL=VERB");
console.log("Accepted levels are VERB, DBUG, INFO, NOTE and WARN, default is NOTE");

export function log(level, str) {
  if (level >= window.DEFAULT_LOG_LEVEL) {
    if (level === WARN) {
      // Show warning with a little yellow icon in Chrome.
      console.warn(str);
    } else {
      console.log(str);
    }
  }
}
