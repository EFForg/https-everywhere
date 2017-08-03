// This file is part of the HTTPS Everywhere issue management bot.
//
// The HTTPS Everywhere issue management bot is free software: you can
// redistribute it and/or modify it under the terms of the GNU Affero
// General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// The HTTPS Everywhere issue management bot is distributed in the
// hope that it will be useful, but WITHOUT ANY WARRANTY; without even
// the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
// PURPOSE.  See the GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public
// License along with the HTTPS Everywhere issue management bot.  If
// not, see <http://www.gnu.org/licenses/>.

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
