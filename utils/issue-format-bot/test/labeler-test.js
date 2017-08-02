'use strict';

const vows = require('perjury'),
      assert = vows.assert,
      makeContext = require('./mocks/context'),
      alexa = require('./mocks/alexa');

vows.describe('issue labeler module').addBatch({
	'When we require the module': {
		topic: function() {
			return require('../lib/labeler');
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it\'s a function': function(err, labeler) {
			assert.isFunction(labeler);
		},
		'and we pass it an issue in the top 100 domains': {
			topic: function(labeler) {
				const context = makeContext.issue();
				labeler(context, {domain: 'domain10.com'}, alexa);
				return context;
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it adds labels to the issue': function(err, context) {
				assert.ok(context.github.issues.addLabels.calledOnce);
			},
			'the label was the top-100 label': function(err, context) {
				const args = context.github.issues.addLabels.args[0];
				assert.isObject(args[0]);
				assert.equal(args[0].labels, ['top-100']);
			}
		}
	}
}).export(module);
