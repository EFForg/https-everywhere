// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const vows = require('perjury'),
  assert = vows.assert,
  _ = require('lodash');

function assertProp(prop, asserter) {
  return function(err, context) {
    assert.isTrue(_.has(context, prop));
    asserter(_.get(context, prop));
  };
}

function assertSinonSpy(prop) {
  return function(err, context) {
    assert.isFunction(_.get(context, prop));
    assert.isDefined(_.get(context, prop).called);
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
    // TODO test that issue numbers aren't the same
    'and we call makeContext.issue()': {
      topic: function(makeContext) {
        return makeContext.issue('Hello world');
      },
      'it works': function(err) {
        assert.ifError(err);
      },
      'it returns an object': function(err, context) {
        assert.isObject(context);
      },
      'context.payload.issue is an object': assertProp('payload.issue', assert.isObject),
      'context.payload.issue.number is a number': assertProp('payload.issue.number', assert.isNumber),
      'context.payload.issue.body is a string': assertProp('payload.issue.body', assert.isString),
      'context.github is an object': assertProp('github', assert.isObject),
      'context.github.issues is an object': assertProp('github.issues', assert.isObject),
      'context.github.issues.createComment is a Sinon spy': assertSinonSpy('github.issues.createComment'),
      'context.github.issues.addLabels is a Sinon spy': assertSinonSpy('github.issues.addLabels'),
      'context.github.issues.removeLabel returns a Promise': function(err, context) {
        const promise = context.github.issues.removeLabel();
        assert.isFunction(promise.then);
      },
      'context.github.issues.removeLabel is a Sinon spy': assertSinonSpy('github.issues.removeLabel'),
      'context.issue is a Sinon spy': assertSinonSpy('issue'),
      'and we call context.issue()': {
        topic: function(context) {
          return context.issue('Wheeee!');
        },
        'it returns whatever we passed': function(context, val) {
          assert.equal(val, 'Wheeee!');
        }
      }
    }
  }
}).export(module);
