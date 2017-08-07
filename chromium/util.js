'use strict';

// Logging everything is *very* slow since the browser will retain console logs even when the developer tools window is closed.

console.log('Hey developer! Want to see more verbose logging?');
console.log('Type this into the console: utils.minLogLevel = 1');
console.log('Accepted levels are 1-5, default is 4.');

const utils = {
	minLogLevel: 4,
	log (str, level) {
		level = level || 1;

	  if (level >= utils.minLogLevel) {
	    if (level >= 5) {
	      console.error(str);
	    } else if (level >= 4) {
	      console.warn(str);
	    } else if (level >= 3) {
	    	console.info(str);
	    } else {
	    	console.log(str);
	    }
	  }
	}
}

if (window) {
	window.utils = utils;
}

if (module) {
	module.exports = utils;
}
