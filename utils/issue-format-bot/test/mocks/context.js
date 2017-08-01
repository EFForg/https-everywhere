'use strict';

const sinon = require('sinon');

let issueNumber = 1;

module.exports = {
	issue: sinon.stub().returns({
		payload: {
			issue: {
				number: issueNumber++
			}
		},
		issue: sinon.spy()
	})
};
