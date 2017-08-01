'use strict';

const sinon = require('sinon');

let issueNumber = 1;

module.exports = {
	issue(body) {
		return {
			payload: {
				issue: {
					number: issueNumber++,
					body
				}
			},
			github: {
				issues: {
					createComment: sinon.spy()
				}
			},
			issue: sinon.spy()
		};
	}
};
