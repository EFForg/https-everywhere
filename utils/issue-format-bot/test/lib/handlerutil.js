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
	const expectingEdit = Boolean(text);

	let obj = {
		topic: function(handler) {
			const context = makeContext.issue('Type: new ruleset\nDomain: domain10.com');

			const result = handler(context);

			// Edit handler is an AsyncFunction, new issue handler is a Function
			if (result && result.then) {
				// Perjury doesn't support promises, so we manually invoke the callback
				result.then(() => {
					this.callback(null, context);
				});
			} else {
				return context;
			}
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it labels the issue appropriately': function(err, context) {
			assert.isTrue(context.github.issues.addLabels.calledOnce);

			// I'm not really sure why these magic numbers work? But they do, sooo...
			// With apologies to whoever's come to edit this
			const args = context.issue.args[expectingEdit ? 1 : 0];

			assert.isObject(args[0]);
			assert.isArray(args[0].labels);
			assert.deepEqual(args[0].labels, ['top-100']);

		}
	};

	if (text) {
		obj['it only creates one comment'] = function(err, context) {
			assert.isTrue(context.github.issues.createComment.calledOnce);
		};

		obj['it says the user fixed it'] = function(err, context) {
			// args[0] is first call arguments, second [0] is first arg
			assert.isObject(context.issue.args[0][0]);
			// TODO try to find a more decoupled way than matching text
			assert.isTrue(context.issue.args[0][0].body.includes(text));
		};
	} else {
		obj['it doesn\'t comment'] = function(err, context) {
			// Once for the labels, once for the comment
			assert.isTrue(context.issue.calledOnce);
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
				assert.isTrue(context.github.issues.createComment.calledOnce);
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
