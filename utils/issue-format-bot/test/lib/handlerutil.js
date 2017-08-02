'use strict';

const vows = require('perjury'),
      assert = vows.assert,
      robot = require('../mocks/robot'),
      alexa = require('../mocks/alexa'),
      _ = require('lodash');

// TODO tests

function setup(path, obj) {
	return {
		'When we require the module': {
			topic: function() {
				return require(path);
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it\'s a function': function(err, newissue) {
				assert.isFunction(newissue);
			},
			// We insert the provided object here
			'and we initialize it with a robot': _.assign({
				topic: function(newissue) {
					return newissue(robot, alexa);
				},
				'it works': function(err) {
					assert.ifError(err);
				},
				'it returns a function': function(err, handler) {
					assert.isFunction(handler);
				}
			}, obj)
		}
	};
}

module.exports.setup = setup;
