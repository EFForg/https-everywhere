'use strict';

const vows = require('perjury'),
      assert = vows.assert,
      robot = require('../mocks/robot'),
      alexa = require('../mocks/alexa'),
      makeContext = require('../mocks/context'),
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

function nullBody(text) {
	return {
		topic: function(handler) {
			const context = makeContext.issue('');

			handler(context);

			return context;
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it only creates one comment': function(err, context) {
			assert.isTrue(context.issue.calledOnce);
		},
		'it creates a comment with the right message': function(err, context) {
			// args[0] is first call arguments, second [0] is first arg
			assert.isObject(context.issue.args[0][0]);
			// TODO try to find a more decoupled way than matching text
			assert.isTrue(context.issue.args[0][0].body.includes(text));
		}
	};
}

function badType(text) {
	return {
		topic: function(handler) {
			const context = makeContext.issue('Type: invalid');

			handler(context);

			return context;
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it only creates one comment': function(err, context) {
			assert.isTrue(context.issue.calledOnce);
		},
		'it creates a comment with the right message': function(err, context) {
			// args[0] is first call arguments, second [0] is first arg
			assert.isObject(context.issue.args[0][0]);
			// TODO try to find a more decoupled way than matching text
			assert.isTrue(context.issue.args[0][0].body.includes(text));
		}
	};
}

function correctNewRuleset(text) {
	let obj = {
		topic: function(handler) {
			const context = makeContext.issue('Type: new ruleset\nDomain: example.com');

			handler(context);

			return context;
		},
		'it works': function(err) {
			assert.ifError(err);
		}
	};

	if (text) {
		obj['it only creates one comment'] = function(err, context) {
			assert.isTrue(context.issue.calledOnce);
		};

		obj['it says the user fixed it'] = function(err, context) {
			// args[0] is first call arguments, second [0] is first arg
			assert.isObject(context.issue.args[0][0]);
			// TODO try to find a more decoupled way than matching text
			assert.isTrue(context.issue.args[0][0].body.includes(text));
		};
	} else {
		obj['it doesn\'t comment'] = function(err, context) {
			assert.isTrue(context.issue.notCalled);
		};
	}

	return obj;
}

function problematicNewRuleset(text) {
	return {
			topic: function(handler) {
				const context = makeContext.issue('Type: new ruleset');

				handler(context);

				return context;
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it only creates one comment': function(err, context) {
				assert.isTrue(context.issue.calledOnce);
			},
			'it includes the problem': function(err, context) {
				// args[0] is first call arguments, second [0] is first arg
				assert.isObject(context.issue.args[0][0]);
				// TODO try to find a more decoupled way than matching text
				assert.isTrue(context.issue.args[0][0].body.includes(text));
			}
	};
}

module.exports.setup = setup;
module.exports.nullBody = nullBody;
module.exports.badType = badType;
module.exports.correctNewRuleset = correctNewRuleset;
module.exports.problematicNewRuleset = problematicNewRuleset;
