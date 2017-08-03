// Copyright 2017 AJ Jordan
//
// This file is part of the HTTPS Everywhere issue management bot.
//
// The HTTPS Everywhere issue management bot is free software: you can
// redistribute it and/or modify it under the terms of the GNU Affero
// General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// The HTTPS Everywhere issue management bot is distributed in the
// hope that it will be useful, but WITHOUT ANY WARRANTY; without even
// the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
// PURPOSE.  See the GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public
// License along with the HTTPS Everywhere issue management bot.  If
// not, see <http://www.gnu.org/licenses/>.

'use strict';

const SIZE = 1000;

const regex = /^domain(\d+).com$/;

function indexOf(str) {
	const match = regex.exec(str);

	if (match && Number(match[1]) <= SIZE) {
		return Number(match[1]) - 1;
	} else {

		/*
		  ESLint is too dumb to realize that this always has a
		  bound `this` from the Proxy, so it's not invalid;
		  that Function#apply is clearer here than using
		  Reflect.apply and isn't the usual overly verbose
		  syntax people use; and that using `arguments` is
		  clearer than using spread syntax (and is one of the
		  rare cases where there isn't really a significant
		  advantage to spread syntax). So we disable it for
		  this line.

		  TODO: report this upstream
		*/

		/* eslint-disable */
		return Array.prototype.indexOf.apply(this, arguments);
		/* eslint-enable */
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
