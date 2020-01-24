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

  describe('isValidHostname', function() {
    it('return true for common hosts', function() {
      assert.strictEqual(util.isValidHostname('example.com'). true);
      assert.strictEqual(util.isValidHostname('www.example.com'). true);
      assert.strictEqual(util.isValidHostname('www.subdomain.example.com'). true);
    });

    it('return true for wildcard hosts', function() {
      assert.strictEqual(util.isValidHostname('example.*'). true);
      assert.strictEqual(util.isValidHostname('example.com.*'). true);
      assert.strictEqual(util.isValidHostname('*.example.com'). true);
      assert.strictEqual(util.isValidHostname('*.subdomain.example.com'). true);
    });

    it('return false for ill-formed hosts', function() {
      // construct a lengthy hostname which host.length > 255
      let prefix = "e1234567890.";
      let lengthyHostname = "example.com";

      for (let i = 0; i < 100; ++i) {
        lengthyHostname = (prefix + lengthyHostname);
      }

      assert.strictEqual(util.isValidHostname(null), false);
      assert.strictEqual(util.isValidHostname(''), false);
      assert.strictEqual(util.isValidHostname(lengthyHostname), false);
      assert.strictEqual(util.isValidHostname('example..com'), false);
      assert.strictEqual(util.isValidHostname('www.example..com'), false);
    });
  })

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
      assert.strictEqual(util.getWildcardExpressions(null).size, 0);
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
