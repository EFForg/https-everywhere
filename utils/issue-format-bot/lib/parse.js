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
