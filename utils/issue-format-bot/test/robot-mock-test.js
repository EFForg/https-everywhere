'use strict';

const vows = require('perjury'),
      assert = vows.assert;

vows.describe('robot mock object').addBatch({
	'When we require the module': {
		topic: function() {
			return require('./mocks/robot');
		},
		'it works': function(err, robot) {
			assert.ifError(err);
		},
		'it\'s an object': function(err, robot) {
			assert.isObject(robot);
		},
		'we can call log() on it': function(err, robot) {
			return robot.log('Hello, world!');
		}
	}
}).export(module);
