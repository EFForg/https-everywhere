// Copyright 2017 AJ Jordan
//
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
      labeler = require('./labeler.js'),
      _ = require('lodash');

module.exports = function(robot, alexa) {
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

		const problems = validate(data);

		if (problems.length === 0) {
			// User submission is OK

			return labeler(context, data, alexa);
		} else {
			// Submit a comment telling them what the issues were
			let comment = 'Thanks for your contribution to HTTPS Everywhere! ';
			comment += 'Unfortunately, I wasn\'t able to understand your submission. ';
			comment += 'Here are the problems I ran into:\n\n';
			problems.forEach(problem => comment += ` * ${problem}\n`);
			comment += '\nIf you edit your issue, I\'ll try again and report back if I have problems again.';
			const params = context.issue({body: comment});
			return context.github.issues.createComment(params);

		}
	};
};
