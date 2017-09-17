// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const sinon = require('sinon');

let issueNumber = 1;

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
          addLabels: sinon.spy()
        }
      },
      issue: sinon.spy()
    };
  }
};
