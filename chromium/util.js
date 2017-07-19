'use strict'
;(function () {
  window.VERB = 1
  window.DBUG = 2
  window.INFO = 3
  window.NOTE = 4
  window.WARN = 5
  // FYI: Logging everything is /very/ slow. Chrome will log & buffer
  // these console logs even when the debug tools are closed. :(

  // TODO: Add an easy UI to change the log level.
  // (Developers can just type DEFAULT_LOG_LEVEL=VERB in the console)
  window.DEFAULT_LOG_LEVEL = window.NOTE
  console.log('Hey developer! Want to see more verbose logging?')
  console.log('Type this into the console: DEFAULT_LOG_LEVEL=VERB')
  console.log('Accepted levels are VERB, DBUG, INFO, NOTE and WARN, default is NOTE')

  window.log = function (level, str) {
    if (level >= window.DEFAULT_LOG_LEVEL) {
      if (level === window.WARN) {
        // Show warning with a little yellow icon in Chrome.
        console.warn(str)
      } else {
        console.log(str)
      }
    }
  }
})()
