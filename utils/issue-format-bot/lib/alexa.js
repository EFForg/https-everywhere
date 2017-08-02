'use strict';

const request = require('request'),
      unzip = require('unzip');

// (Heavily) modified from code by @Hainish in utils/labeller. Thanks, @Hainish!

// TODO test this file

module.exports = function getAlexa(cb) {

	const alexa = [];
	const csvRegex = /^[0-9]+,(.+)/;

	request.get('https://s3.amazonaws.com/alexa-static/top-1m.csv.zip')
	       .on('error', err => {
		       cb(err);
	       })
	       // Dumb ESLint. It's not my fault this person named it like that!?
	       .pipe(unzip.Parse()) // eslint-disable-line new-cap
	       .on('entry', entry => {
		        // TODO this use of readline is super confusing??
			const lineReader = require('readline').createInterface({
				input: entry
			});

			lineReader.on('line', line => {
				const domain = line.match(csvRegex)[1];
				alexa.push(domain);
			});

			lineReader.on('close', () => {
				cb(null, alexa);
			});
		});
};
