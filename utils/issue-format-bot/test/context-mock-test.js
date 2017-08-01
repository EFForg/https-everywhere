const vows = require('perjury'),
      assert = vows.assert,
      _ = require('lodash');

function assertProp(prop, asserter) {
	return function(err, context) {
		assert.isTrue(_.has(context, prop));
		asserter(_.get(context, prop));
	};
}

vows.describe('context mock object').addBatch({
	'When we require the module': {
		topic: function() {
			return require('./mocks/context');
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it\'s an object': function(err, makeContext) {
			assert.isObject(makeContext);
		},
		'it has an issue() factory function': function(err, makeContext) {
			assert.isFunction(makeContext.issue);
		},
		'and we call makeContext.issue()': {
			topic: function(makeContext) {
				return makeContext.issue();
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it returns an object': function(err, context) {
				assert.isObject(context);
			},
			'context.payload.issue is an object': assertProp('payload.issue', assert.isObject),
			'context.payload.issue.number is a number': assertProp('payload.issue.number', assert.isNumber),
			'context.issue() is a Sinon spy': function(err, context) {
				assert.isFunction(context.issue);
				assert.isDefined(context.issue.called);
			}
		}
	}
}).export(module);
