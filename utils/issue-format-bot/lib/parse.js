// Takes in an issue body and parses it into key-value pairs, normalizes it, and returns an Object

'use strict';

const strip = require('strip-markdown'),
      remark = require('remark'),
      processor = remark().use(strip),
      fromPairs = require('lodash.frompairs');

module.exports = function(body) {
	const plaintext = String(processor.processSync(body));

	const lines = plaintext.split('\n')
	                       .map(line => line.split(':').map(key => key.trim()));

	// Filter result looks like [ [ 'Type', 'ruleset issue' ] ]
	const type = lines.filter(line => line[0] === 'Type')[0][1];

	if (type !== 'ruleset issue') return false;

	let normalized = lines.map(line => [line[0].toLowerCase(), line[1]]);
	normalized = fromPairs(normalized);

	return normalized;
};
