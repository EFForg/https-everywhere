'use strict';

const sinon = require('sinon');

let issueNumber = 1;

module.exports = {
	issue() {
		return {
			payload: {
				issue: {
					number: issueNumber++
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
