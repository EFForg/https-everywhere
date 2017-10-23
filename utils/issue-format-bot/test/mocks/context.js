// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const sinon = require('sinon');

let issueNumber = 1;

function noop() {}

module.exports = {
  // Note: this is NOT the `context.issue` you see in-source
  // This is used to create `context` itself; `context.issue` is the Sinon spy you see below
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
          createComment: sinon.spy(),
          // TODO actually make this keep track of data
          getComments: function() {
            return {
              data: []
            };
          },
          addLabels: sinon.spy(),
          removeLabel: sinon.spy(() => new Promise(noop))
        }
      },
      // Blindly pass through the first argument as the return value
      issue: sinon.spy(arg => arg)
    };
  }
};
