// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const vows = require('perjury'),
  assert = vows.assert,
  makeContext = require('./mocks/context'),
  alexa = require('./mocks/alexa');

// Note: we only test top 100 and top 1000 because the Alexa mock supports only 1000 items
// (Or in other words, `new Array(1000000)` hung my Node REPL process when I tried it.)

// We have to do this funky thing so the tests run in serial
// If they run in parallel, Sinon spies don't reset deterministically and one of the assertions will fail because the spy's been called more than once from another suite
function setup(name, obj) {
  const ret = {
    'When we require the module': {
      topic: function() {
        return require('../lib/labeler');
      },
      'it works': function(err) {
        assert.ifError(err);
      },
      'it\'s a function': function(err, labeler) {
        assert.isFunction(labeler);
      }
    }
  };

  ret['When we require the module'][name] = obj;

  return ret;
}

function resetSpies(context) {
  return context.github.issues.addLabels.reset();
}

function addLabelsCalledOnce(err, context) {
  assert.isTrue(context.github.issues.addLabels.calledOnce);
}

function assertWhichLabel(label) {
  return function(err, context) {
    const args = context.github.issues.addLabels.args[0];

    assert.isObject(args[0]);
    assert.isArray(args[0].labels);
    assert.deepEqual(args[0].labels, [label]);
  };
}

function assertOtherLabelsRemoved(labels) {
  return function(err, context) {
    const calledLabels = context.github.issues.removeLabel.args.map(args => args[0].name);
    assert.deepEqual(calledLabels, labels);
  };
}

vows.describe('issue labeler module').addBatch(setup(
  'and we pass it an issue in the top 100 domains', {
    topic: function(labeler) {
      const context = makeContext.issue();
      // XXX should we test on the boundaries of different labels instead of in the middle?
      labeler(context, {domain: 'domain10.com'}, alexa);
      return context;
    },
    teardown: resetSpies,
    'it works': function(err) {
      assert.ifError(err);
    },
    'it adds labels to the issue only once': addLabelsCalledOnce,
    'the label was the top-100 label': assertWhichLabel('top-100'),
    'all other labels were removed': assertOtherLabelsRemoved(['top-1k', 'top-10k', 'top-100k', 'top-1m'])
  }
)).addBatch(setup(
  'and we pass it an issue in the top 1,000 domains', {
    topic: function(labeler) {
      const context = makeContext.issue();
      // XXX should we test on the boundaries of different labels instead of in the middle?
      labeler(context, {domain: 'domain500.com'}, alexa);
      return context;
    },
    teardown: resetSpies,
    'it works': function(err) {
      assert.ifError(err);
    },
    'it adds labels to the issue only once': addLabelsCalledOnce,
    'the label was the top-1k label': assertWhichLabel('top-1k'),
    'all other labels were removed': assertOtherLabelsRemoved(['top-100', 'top-10k', 'top-100k', 'top-1m'])
  }
)).export(module);
