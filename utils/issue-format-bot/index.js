'use strict';

const _ = require('lodash'),
      newissue = require('./lib/newissue');

module.exports = robot => {
	robot.log('HTTPS Everywhere ruleset parser started.');

	// TODO parse issue edits too
	robot.on('issues.opened', newissue(robot));
};
