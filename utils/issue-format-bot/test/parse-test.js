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

function assertCorrectBody(text) {
	return {
		topic: function(parse) {
			return parse(text);
		},
		'it returns an object': function(err, obj) {
			assert.ifError(err);
			assert.isObject(obj);
		},
		'the object has the right data': function(err, obj) {
			assert.includes(obj, 'domain');
			assert.equal(obj.domain, 'example.com');
		}
	};
}

function assertTypeSucceeds(type) {
	return {
		topic: function(parse) {
			return parse('Type: ' + type);
		},
		'it returns an object': function(err, obj) {
			assert.ifError(err);
			assert.isObject(obj);
		},
		'the object is normal data': function(err, obj) {
			assert.equal(obj.type, type);
		}
	};
}

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
		'and we pass it a body that\'s a ruleset issue': assertCorrectBody('Type: ruleset issue\nDomain: example.com'),
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
		'and we pass it a body with out-of-order data': assertCorrectBody('Domain: example.com\nType: ruleset issue'),
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
		'and we pass it a body that has a full URL in the domain': {
			topic: function(parse) {
				return parse('Type: ruleset issue\nDomain: http://example.com/index.html');
			},
			'it returns an object': function(err, obj) {
				assert.ifError(err);
				assert.isObject(obj);
			},
			'the URL was converted into a bare domain': function(err, obj) {
				assert.includes(obj, 'domain');
				assert.equal(obj.domain, 'example.com');
			}
		},
		'and we pass it a body that has a freeform comment': assertCorrectBody('Type: new ruleset\nDomain: example.com\nAnd let me say, what a great GitHub bot HTTPS Everywhere has!'),
		'and we pass it a body that has a freeform comment with a Markdown link': assertCorrectBody('Type: new ruleset\nDomain: example.com\nPlease add [example.com][].\n\n [example.com]: http://example.com.'),
		'and we pass it a body that has a freeform comment with colons': assertCorrectBody('Type: new ruleset\nDomain: example.com\nHere\'s a secret: I like colons.'),
		'and we pass it a body that has a freeform comment with multiple colons': assertCorrectBody('Type: new ruleset\nDomain: example.com\nHere\'s a secret: I like colons. Another secret: I like them a lot.'),
		'and we pass it a code issue without any other data': assertTypeSucceeds('code issue'),
		'and we pass it a feature request without any other data': assertTypeSucceeds('feature request'),
		'and we pass it an issue labeled "other" without any other data': assertTypeSucceeds('other'),
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
