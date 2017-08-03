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
      assert = vows.assert,
      makeContext = require('./mocks/context'),
      alexa = require('./mocks/alexa');

// Note: we only test top 100 and top 1000 because the Alexa mock supports only 1000 items
// (Or in other words, `new Array(1000000)` hung my Node REPL process when I tried it.)

// We have to do this funky thing so the tests run in serial
// If they run in parallel, Sinon spies don't reset deterministically and one of the assertions will fail because the spy's been called more than once from another suite
function setup(name, obj) {
	const ret = {
		'When we require the module': {
			topic: function() {
				return require('../lib/labeler');
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it\'s a function': function(err, labeler) {
				assert.isFunction(labeler);
			}
		}
	};

	ret['When we require the module'][name] = obj;

	return ret;
}

function resetSpies(context) {
	return context.github.issues.addLabels.reset();
}

vows.describe('issue labeler module').addBatch(setup(
	'and we pass it an issue in the top 100 domains', {
		topic: function(labeler) {
			const context = makeContext.issue();
			// XXX should we test on the boundaries of different labels instead of in the middle?
			labeler(context, {domain: 'domain10.com'}, alexa);
			return context;
		},
		teardown: resetSpies,
		'it works': function(err) {
			assert.ifError(err);
		},
		'it adds labels to the issue only once': function(err, context) {
			assert.ok(context.github.issues.addLabels.calledOnce);
		},
		'the label was the top-100 label': function(err, context) {
			// XXX should we test addLabels() arguments?
			// Currently we don't because context.issue is a Sinon spy that returns nothing, which gets passed to addLabels()
			const args = context.issue.args[0];

			assert.isObject(args[0]);
			assert.isArray(args[0].labels);
			assert.deepEqual(args[0].labels, ['top-100']);
		}
	}
)).addBatch(setup(
	'and we pass it an issue in the top 1,000 domains', {
		topic: function(labeler) {
			const context = makeContext.issue();
			// XXX should we test on the boundaries of different labels instead of in the middle?
			labeler(context, {domain: 'domain500.com'}, alexa);
			return context;
		},
		teardown: resetSpies,
		'it works': function(err) {
			assert.ifError(err);
		},
		'it adds labels to the issue only once': function(err, context) {
			assert.ok(context.github.issues.addLabels.calledOnce);
		},
		'the label was the top-1k label': function(err, context) {
			// XXX should we test addLabels() arguments?
			// Currently we don't because context.issue is a Sinon spy that returns nothing, which gets passed to addLabels()
			const args = context.issue.args[0];

			assert.isObject(args[0]);
			assert.isArray(args[0].labels);
			assert.deepEqual(args[0].labels, ['top-1k']);
		}
	}
)).export(module);
