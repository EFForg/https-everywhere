'use strict';

const assert = require('chai').assert,
  util = require('../background-scripts/util');


describe('util.js', function() {
  describe('nullIterable', function() {
    it('is iterable zero times and is size 0', function() {
      let count = 0;
      for (let _ of util.nullIterable) { // eslint-disable-line no-unused-vars
        count += 1;
      }
      assert.strictEqual(count, 0);
      assert.strictEqual(util.nullIterable.size,  0);
      assert.isEmpty(util.nullIterable);
    });
  });

  describe('getNormalisedHostname', function() {
    it('removes tailing dots', function() {
      assert.strictEqual(util.getNormalisedHostname('example.com.'), 'example.com');
      assert.strictEqual(util.getNormalisedHostname('example.com..'), 'example.com');
    });

    it('preserves a single dot', function() {
      assert.strictEqual(util.getNormalisedHostname('.'), '.');
    });
  });

  describe('getWildcardExpressions', function() {
    it('return empty result for ill-formed hosts', function() {
      assert.strictEqual(util.getWildcardExpressions('').size, 0);
      assert.strictEqual(util.getWildcardExpressions('example.com..').size, 0);
    });

    it('return empty result for wildcard hosts', function() {
      assert.strictEqual(util.getWildcardExpressions('example.*').size, 0);
      assert.strictEqual(util.getWildcardExpressions('example.com.*').size, 0);
      assert.strictEqual(util.getWildcardExpressions('*.example.com').size, 0);
      assert.strictEqual(util.getWildcardExpressions('*.subdomain.example.com').size, 0);
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
        assert.deepEqual(util.getWildcardExpressions(host), params[host]);
      }
    });
  });
});
