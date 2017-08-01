'use strict';

const sinon = require('sinon');

let issueNumber = 1;

module.exports = {
	issue: sinon.stub().returns({
		payload: {
			issue: {
				// TODO this doesn't actually work because of static .returns({})
				number: issueNumber++
			}
		},
		github: {
			issues: {
				createComment: sinon.spy()
			}
		},
		issue: sinon.spy()
	})
};
