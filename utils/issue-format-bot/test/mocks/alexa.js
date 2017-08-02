'use strict';

const SIZE = 100;

const regex = /^domain(\d+).com$/;

function indexOf(str) {
	const match = regex.exec(str);

	if (match && Number(match[1]) < 100) {
		return Number(match[1]) - 1;
	} else {
		return Array.prototype.indexOf.apply(this, arguments);
	}
}

module.exports = new Proxy(new Array(SIZE), {
	get: function(target, name) {
		// Override Array#indexOf
		if (name === 'indexOf') {
			return indexOf.bind(target);
		}

		// Node REPL uses symbols apparently, which throw TypeErrors when isNaN coerces them, so do those first
		if (typeof name === 'symbol' || isNaN(name) || name >= SIZE) return target[name];
		return `domain${Number(name) + 1}.com`;
	}
});
