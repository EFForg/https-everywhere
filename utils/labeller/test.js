'use strict';

const assert = require('chai').assert;
const utils = require('./utils.js');

describe('index.js', () => {
  describe('Utils.return_label', () => {
    it('returns proper rank label', () => {
      let testUtils = new utils.Utils();
      assert.equal(testUtils.return_label(89), 'top-100', "doesn't match label");
      assert.equal(testUtils.return_label(899), 'top-1k', "doesn't match label");
      assert.equal(testUtils.return_label(8999), 'top-10k', "doesn't match label");
      assert.equal(testUtils.return_label(89999), 'top-100k', "doesn't match label");
      assert.equal(testUtils.return_label(899999), 'top-1m', "doesn't match label");
    });
  });
});
