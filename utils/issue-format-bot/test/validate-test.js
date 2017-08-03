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

const vows = require('perjury'),
      assert = vows.assert;

function missingRequiredDomain(type) {
	return 	{
		topic: function(validate) {
			return validate({
				type
			});
		},
		'it returns an array': function(err, problems) {
			assert.ifError(err);
			assert.isArray(problems);
		},
		'the array has only one problem': function(err, problems) {
			assert.equal(problems.length, 1);
		},
		'the array has a missing domain problem': function(err, problems) {
			assert.isTrue(problems[0].includes('missing domain'));
		}
	};
}

function hasRequiredDomain(type) {
	return 	{
		topic: function(validate) {
			return validate({
				type,
				domain: 'example.com'
			});
		},
		'it returns an array': function(err, problems) {
			assert.ifError(err);
			assert.isArray(problems);
		},
		'the array has no problems': function(err, problems) {
			assert.equal(problems.length, 0);
		}
	};
}

vows.describe('data validator module').addBatch({
	'When we require the module': {
		topic: function() {
			return require('../lib/validate');
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it\'s a function': function(err, validate) {
			assert.isFunction(validate);
		},
		'and we pass it a new ruleset without a domain': missingRequiredDomain('new ruleset'),
		'and we pass it a ruleset issue without a domain': missingRequiredDomain('ruleset issue'),
		'and we pass it a new ruleset with a domain': hasRequiredDomain('new ruleset'),
		'and we pass it a ruleset issue with a domain': hasRequiredDomain('ruleset issue')
	}
}).export(module);
