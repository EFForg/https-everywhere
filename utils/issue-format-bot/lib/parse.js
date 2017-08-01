// Takes in an issue body and parses it into key-value pairs, normalizes it, and returns an Object

'use strict';

const strip = require('strip-markdown'),
      remark = require('remark'),
      processor = remark().use(strip),
      _ = require('lodash');

const validTypes = ['ruleset issue', 'new ruleset', 'code issue', 'feature request'];

module.exports = function parseDescription(body) {
	const plaintext = String(processor.processSync(body));

	// Check if there's no description at all
	if (plaintext.trim().length === 0) return new Error('null description');

	// Split by newlines, filter blanks, split into trimmed key-value and lowercase everything
	const lines = plaintext.split('\n')
	                       .filter(line => _.compact(line).length !== 0)
	                       .map(line => line.split(':').map(key => key.trim()))
	                       .map(line => [line[0].toLowerCase(), line[1]]);
	// Filter result looks like [ [ 'Type', 'ruleset issue' ] ]
	const type = lines.filter(line => line[0] === 'type')[0][1];

	if (!validTypes.includes(type)) return new Error('invalid type');

	// Convert to object
	let normalized = _.fromPairs(lines);

	return normalized;
};
