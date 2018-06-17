// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const parse = require('./parse'),
  validate = require('./validate'),
  labeler = require('./labeler'),
  helptext = require('./helptext'),
  _ = require('lodash');

// We do this outside the event handler to avoid setting up and tearing down this object each time a hook is received
const botStartDate = new Date('2017-09-25');

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

    const createdAt = new Date(context.payload.issue.created_at);
    if (createdAt <= botStartDate) {
      robot.log('Ignoring event for a legacy, pre-bot issue.');
      return;
    }

    const data = parse(context.payload.issue.body);

    // Check if the data is problematic
    if (data instanceof Error) {
      // Dumb `switch` statement cases aren't technically blocks so saying `const params` in both of them causes redeclaration errors
      let params;
      switch (data.message) {
      case 'invalid type':
        params = context.issue({body: 'Sorry, I still couldn\'t understand the type of issue you specified. Did you look at the [issue template](https://github.com/EFForg/https-everywhere/blob/master/.github/ISSUE_TEMPLATE.md)?\n\nPlease try again.' + helptext});
        return context.github.issues.createComment(params);
      case 'multiple types':
        params = context.issue({body: 'Sorry, but I\'m still seeing more than one type. Can you edit your issue and delete all but one of the types in your issue?' + helptext});
        return context.github.issues.createComment(params);
      case 'no type':
        params = context.issue({body: 'I still don\'t see the type of issue in your description. Can you edit your issue to add this information (perhaps referring to the [issue template](https://github.com/EFForg/https-everywhere/blob/master/.github/ISSUE_TEMPLATE.md)?)\n\nAll I need is `Type: <type>` on its own line in the issue body. For example, `Type: new ruleset`. The issue template has a list of types I can understand.' + helptext});
        return context.github.issues.createComment(params);
      case 'null description':
        params = context.issue({body: 'I still don\'t see any text in your description - please edit it to use the [issue template](https://github.com/EFForg/https-everywhere/blob/master/.github/ISSUE_TEMPLATE.md). Thank you!' + helptext});
        return context.github.issues.createComment(params);
      default:
        throw data;
      }
    }

    const problems = validate(data);

    if (problems.length === 0) {
      // User submission is OK

      let commentedBefore = false;

      // This won't work if the bot comments success past 100 comments
      // but since this will probably never happen, who cares. Also,
      // the bot was originally put into production late September, so
      // only ask for comments after then.
      //
      // XXX handle the user screwing up, then fixing it (and getting
      // the success comment), then screwing up again
      const _allComments = await context.github.issues.getComments(context.issue({
        per_page: 100, // eslint-disable-line camelcase
        since: '2017-09-25'
      }));
      const allComments = _allComments.data;

      allComments.forEach(comment => {
        // 'Your edit helped me out' is here to match legacy comments
        // before this conditional was put in place
        if (comment.body.includes('HELPED_COMMENT_POSTED')
            || comment.body.includes('Your edit helped me out')) {
          commentedBefore = true;
        }
      });

      if (commentedBefore) return;

      const params = context.issue({body: 'Thanks! Your edit helped me out. I\'ll take it from here now. <!-- HELPED_COMMENT_POSTED -->'});
      await context.github.issues.createComment(params);

      return labeler(context, data, alexa);
    } else {
      // Submit a comment telling them what the issues were
      let comment = 'Thanks for editing!\n\n';
      comment += 'I\'m sorry, but I still couldn\'t understand your submission. ';
      comment += 'Here are the problems I ran into this time:\n\n';
      problems.forEach(problem => comment += ` * ${problem}\n`);
      comment += '\nIf you edit your issue again, I\'ll try again and report back if I have problems again.';
      comment += helptext
      const params = context.issue({body: comment});
      return context.github.issues.createComment(params);
    }
  };
};
