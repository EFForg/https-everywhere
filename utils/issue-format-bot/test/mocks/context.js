'use strict';

let issueNumber = 1;

module.exports = {
	issue() {
		return {
			payload: {
				issue: {
					number: issueNumber++
				}
			}
		};
	}
};
