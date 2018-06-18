/* eslint-env es6, node */
/* globals gc */

'use strict';

if (typeof gc !== 'function') {
	throw new Error('Please re-run with `node --expose-gc utils/memusage.js`');
}

const { RuleSets } = require('../chromium/background-scripts/rules');
const { readFileSync } = require('fs');
const json = JSON.parse(readFileSync(`${__dirname}/../rules/default.rulesets`, 'utf-8'));

function memUsage() {
	gc(); // don't measure garbage
	return process.memoryUsage().heapUsed;
}

function memToString(before, after) {
	return (Math.round((after - before) / (1 << 20) * 10) / 10).toLocaleString() + ' MB';
}

const start = memUsage();
let middle, end;

{
	const ruleSets = new RuleSets(Object.create(null));
	ruleSets.addFromJson(json);
	middle = memUsage();
}

{
	const oldRegExp = RegExp;

	global.RegExp = function (...args) {
		let r = new oldRegExp(...args);
		r.test(''); // force engine to compile RegExp
		return r;
	};

	const ruleSets = new RuleSets(Object.create(null));
	ruleSets.addFromJson(json);
	end = memUsage();
}

// rulesets loaded but regexps are not compiled
console.log('Initial usage:', memToString(start, middle));

// with all regexps compiled
console.log('Maximum usage:', memToString(middle, end));
