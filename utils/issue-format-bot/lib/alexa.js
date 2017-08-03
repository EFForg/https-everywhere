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

const request = require('request'),
      unzip = require('unzip');

// (Heavily) modified from code by @Hainish in utils/labeller. Thanks, @Hainish!

// TODO make this return Promises
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
