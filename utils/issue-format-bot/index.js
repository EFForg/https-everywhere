// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const alexa = require('./lib/alexa'),
  newissue = require('./lib/newissue'),
  issueedit = require('./lib/issueedit');

module.exports = robot => {
  robot.log('HTTPS Everywhere ruleset parser started.');

  alexa(robot.log, (err, domains) => {
    if (err) throw err;

    robot.on('issues.opened', newissue(robot, domains));
    robot.on('issues.edited', issueedit(robot, domains));

    robot.log('Listening for new issues and issue edits.');
  });
};
