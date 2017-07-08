const vows = require('perjury'),
      assert = vows.assert,
      _ = require('lodash');

vows.describe('issue parser module').addBatch({
	'When we require the module': {
		topic: function() {
			return require('../lib/parse');
		},
		'it works': function(err, parse) {
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
		'and we pass it a body that isn\'t a ruleset issue': {
			topic: function(parse) {
				return parse('Type: something else\nDomain: example.com');
			},
			'it returns false': function(err, obj) {
				assert.ifError(err);
				assert.isFalse(obj);
			}
		}
	}
}).export(module);
