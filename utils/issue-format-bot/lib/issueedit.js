// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const parse = require('./parse'),
  validate = require('./validate'),
  labeler = require('./labeler'),
  _ = require('lodash');

// TODO make this share more with newissue.js?

module.exports = function(robot, alexa) {
  return async context => {
    robot.log('Issue #' + context.payload.issue.number + ' edited; responding.');

    // Check if the "issue" is really a PR
    // I can't really tell if GitHub will ever send us something like this, honestly... but bettter safe than sorry.
    if (_.has(context.payload.issue, 'pull_request')) {
      robot.log('Issue is a Pull Request; aborting.');
      return;
    }

    const data = parse(context.payload.issue.body);

    // Check if the data is problematic
    if (data instanceof Error) {
      // Dumb `switch` statement cases aren't technically blocks so saying `const params` in both of them causes redeclaration errors
      let params;
      switch (data.message) {
      case 'invalid type':
        params = context.issue({body: 'Sorry, I still couldn\'t understand the type of issue you specified. Did you look at the issue template?\n\nPlease try again.'});
        return context.github.issues.createComment(params);
      case 'multiple types':
        params = context.issue({body: 'Sorry, but I\'m still seeing more than one type. Can you edit your issue and delete all but one of the types in your issue?'});
        return context.github.issues.createComment(params);
      case 'no type':
        params = context.issue({body: 'I still don\'t see the type of issue in your description. Can you edit your issue to add this (perhaps referring to the [issue template](https://github.com/EFForg/https-everywhere/blob/master/.github/ISSUE_TEMPLATE.md)?)'});
        return context.github.issues.createComment(params);
      case 'null description':
        params = context.issue({body: 'I still don\'t see any text in your description - please edit it to use the issue template. Thank you!'});
        return context.github.issues.createComment(params);
      default:
        throw data;
      }
    }

    const problems = validate(data);

    if (problems.length === 0) {
      // User submission is OK
      const params = context.issue({body: 'Thanks! Your edit helped me out. I\'ll take it from here now.'});
      await context.github.issues.createComment(params);

      return labeler(context, data, alexa);
    } else {
      // Submit a comment telling them what the issues were
      let comment = 'Thanks for editing!\n\n';
      comment += 'I\'m sorry, but I still couldn\'t to understand your submission. ';
      comment += 'Here are the problems I ran into this time:\n\n';
      problems.forEach(problem => comment += ` * ${problem}\n`);
      comment += '\nIf you edit your issue again, I\'ll try again and report back if I have problems again.';
      const params = context.issue({body: comment});
      return context.github.issues.createComment(params);

    }
  };
};
