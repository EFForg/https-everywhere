const vows = require('perjury'),
      assert = vows.assert;

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
		}
	}
}).export(module);
