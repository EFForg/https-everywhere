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
      assert = vows.assert,
      _ = require('lodash');

vows.describe('issue parser module').addBatch({
	'When we require the module': {
		topic: function() {
			return require('../lib/parse');
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it\'s a function': function(err, parse) {
			assert.isFunction(parse);
		},
		'and we pass it a body that\'s a ruleset issue': {
			topic: function(parse) {
				return parse('Type: ruleset issue\nDomain: example.com');
			},
			'it returns an object': function(err, obj) {
				assert.ifError(err);
				assert.isObject(obj);
			},
			'the object has the right data': function(err, obj) {
				assert.includes(obj, 'domain');
				assert.equal(obj.domain, 'example.com');
			}
		},
		'and we pass it a body with funky capitalization': {
			topic: function(parse) {
				return parse('tyPe: ruleset issue\nDoMaIn: example.com');
			},
			'it returns an object': function(err, obj) {
				assert.ifError(err);
				assert.isObject(obj);
			},
			'the capitalization didn\'t matter': function(err, obj) {
				assert.includes(obj, 'domain');
				assert.equal(obj.domain, 'example.com');
			}
		},
		'and we pass it a body with out-of-order data': {
			topic: function(parse) {
				return parse('Domain: example.com\nType: ruleset issue');
			},
			'it returns an object': function(err, obj) {
				assert.ifError(err);
				assert.isObject(obj);
			},
			'the object has the right data': function(err, obj) {
				assert.includes(obj, 'domain');
				assert.equal(obj.domain, 'example.com');
			}
		},
		'and we pass it a body with lots of whitespace': {
			topic: function(parse) {
				return parse('Type:  ruleset issue         \nDomain:  \t\t   example.com   \t');
			},
			'it returns an object': function(err, obj) {
				assert.ifError(err);
				assert.isObject(obj);
			},
			'the whitespace was trimmed': function(err, obj) {
				assert.includes(obj, 'domain');
				assert.equal(obj.domain, 'example.com');
			}
		},
		'and we pass it a body with many newlines': {
			topic: function(parse) {
				return parse('\n\nType: ruleset issue\n\n\n\nDomain: example.com\n\n');
			},
			'it returns an object': function(err, obj) {
				assert.ifError(err);
				assert.isObject(obj);
			},
			'the newlines were ignored': function(err, obj) {
				assert.equal(_.size(obj), 2);
			}
		},
		'and we pass it a body with some Markdown comments': {
			topic: function(parse) {
				// TODO this should test for comments on the same line too, but see wooorm/strip-markdown#14
				return parse('<!-- comment -->\nType: ruleset issue\n<!-- comment after newline -->\nDomain: example.com');
			},
			'it returns an object': function(err, obj) {
				assert.ifError(err);
				assert.isObject(obj);
			},
			'the object has the right data': function(err, obj) {
				assert.includes(obj, 'domain');
				assert.equal(obj.domain, 'example.com');
			},
			'the object doesn\'t have a bunch of extra keys': function(err, obj) {
				assert.equal(_.size(obj), 2);
			}
		},
		'and we pass it a body that isn\'t a valid issue type': {
			topic: function(parse) {
				return parse('Type: something else\nDomain: example.com');
			},
			'it returns the right error': function(err, obj) {
				assert.ifError(err);
				assert.instanceOf(obj, Error);
				assert.equal(obj.message, 'invalid type');
			}
		},
		'and we pass it a null body': {
			topic: function(parse) {
				return parse('');
			},
			'it returns the right error': function(err, obj) {
				assert.ifError(err);
				assert.instanceOf(obj, Error);
				assert.equal(obj.message, 'null description');
			}
		}
	}
}).export(module);
