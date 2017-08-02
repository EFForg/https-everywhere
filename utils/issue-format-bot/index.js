'use strict';

const alexa = require('./lib/alexa'),
      newissue = require('./lib/newissue'),
      issueedit = require('./lib/issueedit');

module.exports = robot => {
	robot.log('HTTPS Everywhere ruleset parser started.');

	alexa(domains => {
		robot.log('Retrieved Alexa rankings.');

		// TODO parse issue edits too
		robot.on('issues.opened', newissue(robot, domains));
		robot.on('issues.edited', issueedit(robot, domains));

		robot.log('Listening for new issues and issue edits.');
	});
};
