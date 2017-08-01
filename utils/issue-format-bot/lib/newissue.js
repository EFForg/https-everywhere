'use strict';

const parse = require('./parse'),
      _ = require('lodash');

module.exports = function(robot) {
	return context => {
		robot.log('Issue #' + context.payload.issue.number + ' created; responding.');

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
                                params = context.issue({body: 'Hey there, I didn\'t understand the type of issue you specified. Please edit it and try again.'});
                                return context.github.issues.createComment(params);
                        case 'null description':
                                params = context.issue({body: 'Hi! I can\'t find any text in your description - please edit it to use the issue template.'});
                                return context.github.issues.createComment(params);
                        default:
                                throw data;
                        }
                }

		// TODO push validation out to a separate module and test that separately
		let problems = [];

		// Validate that the user submitted all necessary data based on submission type
		switch (data.type) {
		case 'new rulest':
			if (!data.domain) problems.push('Submission is missing domain information');
			break;
		case 'ruleset issue':
			if (!data.domain) problems.push('Submission is missing domain information');
			break;
		}

		if (problems.length === 0) {
			// User submission is OK
			// TODO label things
			// TODO it'd be nice if, once users edit their issue, we affirmatively say "you fixed it"
		} else {
			// Submit a comment telling them what the issues were
			let comment = 'Thanks for your contribution to HTTPS Everywhere! ';
			comment += 'Unfortunately, I wasn\'t able to understand your submission. ';
			comment += 'Here are the problems I ran into:\n\n';
			problems.forEach(problem => comment += ` * ${problem}\n`);
			comment += '\nIf you edit your issue, I\'ll try again and report back if I have problems again.';
		}
	};
};
