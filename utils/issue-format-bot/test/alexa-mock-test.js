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

vows.describe('alexa mock array').addBatch({
	'When we require the module': {
		topic: function() {
			return require('./mocks/alexa');
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it\'s an array': function(err, alexa) {
			assert.isArray(alexa);
		},
		'its length is 1000': function(err, alexa) {
			assert.equal(alexa.length, 1000);
		},
		'its 999th element has the right text': function(err, alexa) {
			assert.equal(alexa[999], 'domain1000.com');
		},
		'its 1000th element is undefined': function(err, alexa) {
			assert.isUndefined(alexa[1000]);
		},
		'and we get a nonexistant property': function(err, alexa) {
			assert.isUndefined(alexa.foobar);
		},
		'and we assign a property': {
			topic: function(alexa) {
				alexa.someProp = 'Hello world!';
				return alexa;
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'the property is there': function(err, alexa) {
				assert.equal(alexa.someProp, 'Hello world!');
			}
		},
		'and we call Array#indexOf with a domain in the array': {
			topic: function(alexa) {
				return alexa.indexOf('domain1000.com');
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it returns the right position': function(err, index) {
				assert.equal(index, 999);
			}
		},
		'and we call Array#indexOf with a domain not in the array': {
			topic: function(alexa) {
				return alexa.indexOf('domain1000000000.com');
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it returns no match': function(err, index) {
				assert.equal(index, -1);
			}
		},
		'and we call Array#indexOf with something not a domain at all': {
			topic: function(alexa) {
				return alexa.indexOf('foobar!');
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it returns no match': function(err, index) {
				assert.equal(index, -1);
			}
		}
	}
}).export(module);
