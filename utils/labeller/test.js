'use strict';

const assert = require('chai').assert;
const process = require('./process.js');

describe('index.js', () => {
  describe('Process.return_label', () => {
    it('returns proper rank label', () => {
      let testProcess = new process.Process();
      assert.equal(testProcess.return_label(89), 'top-100', "doesn't match label");
      assert.equal(testProcess.return_label(899), 'top-1k', "doesn't match label");
      assert.equal(testProcess.return_label(8999), 'top-10k', "doesn't match label");
      assert.equal(testProcess.return_label(89999), 'top-100k', "doesn't match label");
      assert.equal(testProcess.return_label(899999), 'top-1m', "doesn't match label");
    });
  });
});
