'use strict';

const vows = require('perjury'),
      assert = vows.assert,
      makeContext = require('./mocks/context'),
      handlerutil = require('./lib/handlerutil');

vows.describe('new issue handler').addBatch(
	handlerutil.setup('../../lib/newissue', {
		'and we pass it the context of a new issue with a null body': {
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
				assert.isTrue(context.issue.args[0][0].body.includes('can\'t find any text'));
			}
		},
		'and we pass it the context of a new issue with a bad type': {
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
				assert.isTrue(context.issue.args[0][0].body.includes('type of issue'));
			}
		},
		'and we pass it the context of a new issue with a type of "new ruleset" and a correct body': {
			topic: function(handler) {
				const context = makeContext.issue('Type: new ruleset\nDomain: example.com');

				handler(context);

				return context;
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it doesn\'t comment': function(err, context) {
				assert.isTrue(context.issue.notCalled);
			}
		},
		// Problematic bodies aren't tested extensively here because that validation will eventually be refactored into another module and tested there
		'and we pass it the context of a new issue with a type of "new ruleset" and a problematic body': {
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
				assert.isTrue(context.issue.args[0][0].body.includes('missing domain information'));
			}
		}
	})
).export(module);
