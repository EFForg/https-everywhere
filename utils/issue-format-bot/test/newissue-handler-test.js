'use strict';

const vows = require('perjury'),
      assert = vows.assert,
      robot = require('./mocks/robot');

vows.describe('new issue handler').addBatch({
	'When we require the module': {
		topic: function() {
			return require('../lib/newissue');
		},
		'it works': function(err, newissue) {
			assert.ifError(err);
		},
		'it\'s a function': function(err, newissue) {
			assert.isFunction(newissue);
		},
		'and we initialize it with a robot': {
			topic: function(newissue) {
				return newissue(robot);
			},
			'it works': function(err, handler) {
				assert.ifError(err);
			},
			'it returns a function': function(err, handler) {
				assert.isFunction(handler);
			}
		}
	}
}).export(module);
