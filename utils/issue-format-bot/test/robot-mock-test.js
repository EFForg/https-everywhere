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

const vows = require('perjury'),
      assert = vows.assert;

vows.describe('robot mock object').addBatch({
	'When we require the module': {
		topic: function() {
			return require('./mocks/robot');
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it\'s an object': function(err, robot) {
			assert.isObject(robot);
		},
		'we can call log() on it': function(err, robot) {
			return robot.log('Hello, world!');
		}
	}
}).export(module);
