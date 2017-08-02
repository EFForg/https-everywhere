'use strict';

const SIZE = 100;

module.exports = new Proxy(new Array(SIZE), {
	get: function(target, name) {
		// Node REPL uses symbols apparently, which throw TypeErrors when isNaN coerces them, so do those first
		if (typeof name === 'symbol' || isNaN(name) || name >= SIZE) return target[name];
		return `domain${Number(name) + 1}.com`;
	}
});
