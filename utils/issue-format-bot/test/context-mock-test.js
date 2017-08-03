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

const vows = require('perjury'),
      assert = vows.assert,
      _ = require('lodash');

function assertProp(prop, asserter) {
	return function(err, context) {
		assert.isTrue(_.has(context, prop));
		asserter(_.get(context, prop));
	};
}

function assertSinonSpy(prop) {
	return function(err, context) {
		assert.isFunction(_.get(context, prop));
		assert.isDefined(_.get(context, prop).called);
	};
}

vows.describe('context mock object').addBatch({
	'When we require the module': {
		topic: function() {
			return require('./mocks/context');
		},
		'it works': function(err) {
			assert.ifError(err);
		},
		'it\'s an object': function(err, makeContext) {
			assert.isObject(makeContext);
		},
		'it has an issue() factory function': function(err, makeContext) {
			assert.isFunction(makeContext.issue);
		},
		// TODO test that issue numbers aren't the same
		'and we call makeContext.issue()': {
			topic: function(makeContext) {
				return makeContext.issue('Hello world');
			},
			'it works': function(err) {
				assert.ifError(err);
			},
			'it returns an object': function(err, context) {
				assert.isObject(context);
			},
			'context.payload.issue is an object': assertProp('payload.issue', assert.isObject),
			'context.payload.issue.number is a number': assertProp('payload.issue.number', assert.isNumber),
			'context.payload.issue.body is a string': assertProp('payload.issue.body', assert.isString),
			'context.github is an object': assertProp('github', assert.isObject),
			'context.github.issues is an object': assertProp('github.issues', assert.isObject),
			'context.github.issues.createComment is a Sinon spy': assertSinonSpy('github.issues.createComment'),
			'context.github.issues.addLabels is a Sinon spy': assertSinonSpy('github.issues.addLabels'),
			'context.issue is a Sinon spy': assertSinonSpy('issue')
		}
	}
}).export(module);
