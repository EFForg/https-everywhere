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

module.exports = function label(context, data, alexa) {
	const alexaPosition = alexa.indexOf(data.domain);
	const labels = [];

	// TODO remove existing labels in case of edits

	if (alexaPosition === -1) {
		return;
	} else if (alexaPosition < 100) {
		labels.push('top-100');
	} else if (alexaPosition < 1000) {
		labels.push('top-1k');
	} else if (alexaPosition < 10000) {
		labels.push('top-10k');
	} else if (alexaPosition < 100000) {
		labels.push('top-100k');
	} else if (alexaPosition < 1000000) {
		labels.push('top-1m');
	}

	const params = context.issue({labels});
	return context.github.issues.addLabels(params);
};
