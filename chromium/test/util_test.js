'use strict';

const assert = require('chai').assert,
  utils = require('../background-scripts/util');


describe('utils.js', function() {
  describe('getNormalisedHostname', function() {
    it("removes tailing dots", function() {
      assert.strictEqual(utils.getNormalisedHostname("example.com."), "example.com");
      assert.strictEqual(utils.getNormalisedHostname("example.com.."), "example.com");
    });

    it("preserves a single dot", function() {
      assert.strictEqual(utils.getNormalisedHostname("."), ".");
    });
  });
});
