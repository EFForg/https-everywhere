'use strict';

const assert = require('chai').assert,
  utils = require('../background-scripts/util');


describe('utils.js', function() {
  describe('nullIterable', function() {
    it('is iterable zero times and is size 0', function() {
      let count = 0;
      for (let _ of utils.nullIterable) { // eslint-disable-line no-unused-vars
        count += 1;
      }
      assert.strictEqual(count, 0);
      assert.strictEqual(utils.nullIterable.size,  0);
      assert.isEmpty(utils.nullIterable);
    });
  });

  describe('getNormalisedHostname', function() {
    it('removes tailing dots', function() {
      assert.strictEqual(utils.getNormalisedHostname('example.com.'), 'example.com');
      assert.strictEqual(utils.getNormalisedHostname('example.com..'), 'example.com');
    });

    it('preserves a single dot', function() {
      assert.strictEqual(utils.getNormalisedHostname('.'), '.');
    });
  });

  describe('getWildcardExpressions', function() {
    it('return empty result for ill-formed hosts', function() {
      assert.strictEqual(utils.getWildcardExpressions('').size, 0);
      assert.strictEqual(utils.getWildcardExpressions('example.com..').size, 0);
    });

    it('return empty result for wildcard hosts', function() {
      assert.strictEqual(utils.getWildcardExpressions('example.*').size, 0);
      assert.strictEqual(utils.getWildcardExpressions('example.com.*').size, 0);
      assert.strictEqual(utils.getWildcardExpressions('*.example.com').size, 0);
      assert.strictEqual(utils.getWildcardExpressions('*.subdomain.example.com').size, 0);
    });

    it('return list of supported wildcard expression', function() {
      const params = {
        'example.com': [
          'example.*'
        ],
        'www.example.com': [
          'www.example.*',
          '*.example.com'
        ],
        'x.y.z.google.com': [
          'x.y.z.google.*',
          '*.y.z.google.com',
          '*.z.google.com',
          '*.google.com',
        ]
      };

      for (const host in params) {
        assert.deepEqual(utils.getWildcardExpressions(host), params[host]);
      }
    });
  });
});
