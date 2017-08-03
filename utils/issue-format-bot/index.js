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

const alexa = require('./lib/alexa'),
      newissue = require('./lib/newissue'),
      issueedit = require('./lib/issueedit');

module.exports = robot => {
	robot.log('HTTPS Everywhere ruleset parser started.');

	alexa((err, domains) => {
		if (err) throw err;

		robot.log('Retrieved Alexa rankings.');

		robot.on('issues.opened', newissue(robot, domains));
		robot.on('issues.edited', issueedit(robot, domains));

		robot.log('Listening for new issues and issue edits.');
	});
};
