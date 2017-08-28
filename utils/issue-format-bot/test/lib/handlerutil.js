// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const vows = require('perjury'),
  assert = vows.assert,
  robot = require('../mocks/robot'),
  alexa = require('../mocks/alexa'),
  makeContext = require('../mocks/context'),
  _ = require('lodash');

// TODO tests for this file

// INTERNAL UTILITY FUNCTIONS

function itWorks(err) {
  assert.ifError(err);
}

function createsOneComment(err, context) {
  assert.isTrue(context.github.issues.createComment.calledOnce);
}

function createsCommentWithMessage(text) {
  return function(err, context) {
    // args[0] is first call arguments, second [0] is first arg
    assert.isObject(context.issue.args[0][0]);
    // TODO try to find a more decoupled way than matching text
    assert.isTrue(context.issue.args[0][0].body.includes(text));
  };
}

// EXPORTS

function setup(path, obj) {
  return {
    'When we require the module': {
      topic: function() {
        return require(path);
      },
      'it works': itWorks,
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
    'it works': itWorks,
    'it only creates one comment': createsOneComment,
    'it creates a comment with the right message': createsCommentWithMessage(text)
  };
}

function badType(text) {
  return {
    topic: function(handler) {
      const context = makeContext.issue('Type: invalid');

      handler(context);

      return context;
    },
    'it works': itWorks,
    'it only creates one comment': createsOneComment,
    'it creates a comment with the right message': createsCommentWithMessage(text)
  };
}

function multipleTypes(text) {
  return {
    topic: function(handler) {
      const context = makeContext.issue('Type: new ruleset\nType: ruleset issue');

      handler(context);

      return context;
    },
    'it works': itWorks,
    'it only creates one comment': createsOneComment,
    'it creates a comment with the right message': createsCommentWithMessage(text)
  };
}

function noType(text) {
  return {
    topic: function(handler) {
      const context = makeContext.issue('I didn\'t read instructions but I DID find a ruleset issue');

      handler(context);

      return context;
    },
    'it works': itWorks,
    'it only creates one comment': createsOneComment,
    'it creates a comment with the right message': createsCommentWithMessage(text)
  };
}

function correctNewRuleset(issueText, text) {
  const expectingEdit = Boolean(text);

  const obj = {
    topic: function(handler) {
      const context = makeContext.issue(issueText);

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
    'it works': itWorks,
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
    obj['it only creates one comment'] = createsOneComment;

    obj['it says the user fixed it'] = createsCommentWithMessage(text);
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
    'it works': itWorks,
    'it only creates one comment': createsOneComment,
    'it includes the problem': createsCommentWithMessage(text)
  };
}

module.exports.setup = setup;
module.exports.nullBody = nullBody;
module.exports.badType = badType;
module.exports.multipleTypes = multipleTypes;
module.exports.noType = noType;
module.exports.correctNewRuleset = correctNewRuleset;
module.exports.problematicNewRuleset = problematicNewRuleset;
