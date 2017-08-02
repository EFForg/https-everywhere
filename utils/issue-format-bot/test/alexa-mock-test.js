'use strict';

const vows = require('perjury'),
      assert = vows.assert;

vows.describe('alexa mock array').addBatch({
	'When we require the module': {
		topic: function() {
			return require('./mocks/alexa');
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it\'s an array': function(err, alexa) {
			assert.isArray(alexa);
		},
		'its length is 100': function(err, alexa) {
			assert.equal(alexa.length, 100);
		},
		'its 99th element has the right text': function(err, alexa) {
			assert.equal(alexa[99], 'domain100.com');
		},
		'its 100th element is undefined': function(err, alexa) {
			assert.isUndefined(alexa[100]);
		},
		'and we get a nonexistant property': function(err, alexa) {
			assert.isUndefined(alexa['foobar']);
		},
		'and we assign a property': {
			topic: function(alexa) {
				alexa.someProp = 'Hello world!';
				return alexa;
			},
			'it works': function(err, alexa) {
				assert.ifError(err);
			},
			'the property is there': function(err, alexa) {
				assert.equal(alexa.someProp, 'Hello world!');
			}
		},
		'and we call Array#indexOf with a domain in the array': {
			topic: function(alexa) {
				return alexa.indexOf('domain1.com');
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it returns the right position': function(err, index) {
				assert.equal(index, 0);
			}
		},
		'and we call Array#indexOf with a domain not in the array': {
			topic: function(alexa) {
				return alexa.indexOf('domain1000000000.com');
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it returns no match': function(err, index) {
				assert.equal(index, -1);
			}
		},
		'and we call Array#indexOf with something not a domain at all': {
			topic: function(alexa) {
				return alexa.indexOf('foobar!');
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it returns no match': function(err, index) {
				assert.equal(index, -1);
			}
		}
	}
}).export(module);
