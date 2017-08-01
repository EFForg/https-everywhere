'use strict';

const newissue = require('./lib/newissue'),
      issueedit = require('./lib/issueedit');

module.exports = robot => {
	robot.log('HTTPS Everywhere ruleset parser started.');

	// TODO parse issue edits too
	robot.on('issues.opened', newissue(robot));
	robot.on('issues.edited', issueedit(robot));
};
