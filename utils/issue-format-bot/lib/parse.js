// Takes in an issue body and parses it into key-value pairs, normalizes it, and returns an Object

'use strict';

const strip = require('strip-markdown'),
      remark = require('remark'),
      processor = remark().use(strip),
      _ = require('lodash');

module.exports = function(body) {
	const plaintext = String(processor.processSync(body));

	const lines = plaintext.split('\n')
	                       .filter(line => _.compact(line).length !== 0)
	                       .map(line => line.split(':').map(key => key.trim()))
	                       .map(line => [line[0].toLowerCase(), line[1]]);
	// Filter result looks like [ [ 'Type', 'ruleset issue' ] ]
	const type = lines.filter(line => line[0] === 'type')[0][1];

	if (type !== 'ruleset issue') return false;

	let normalized = _.fromPairs(lines);

	return normalized;
};
