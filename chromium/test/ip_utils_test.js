'use strict';

const { parseIp, isIpInRange, isLocalIp } = require('../background-scripts/ip_utils');

const assert = require('chai').assert;

describe('ip_utils.js', () => {
  describe('parseIp', () => {
    it('rejects an empty string', () => {
      assert(parseIp('') === -1);
    });

    it('rejects a string consisting entirely of dots', () => {
      assert(parseIp('.') === -1);
      assert(parseIp('..') === -1);
      assert(parseIp('...') === -1);
      assert(parseIp('....') === -1);
    });

    it('rejects a string consisting only of digits', () => {
      assert(parseIp('1') === -1);
    });

    it('rejects a string not consisting of four parts separated by dots', () => {
      assert(parseIp('1.1') === -1);
      assert(parseIp('1.1.1') === -1);
      assert(parseIp('1.1.1.1.1') === -1);
    });

    it('rejects a well-formed IP address followed by one or multiple trailing dots', () => {
      assert(parseIp('1.1.1.1.') === -1);
      assert(parseIp('1.1.1.1..') === -1);
      assert(parseIp('1.1.1.1...') === -1);
    });

    it('rejects an IP address-like string with omitted parts', () => {
      assert(parseIp('.1.1.1') === -1);
      assert(parseIp('1..1.1') === -1);
      assert(parseIp('1.1..1') === -1);
      assert(parseIp('1.1.1.') === -1);
    });

    it('rejects an IP address-like string with invalid parts', () => {
      assert(parseIp('192.168.1.256') === -1);
      assert(parseIp('192.168.256.1') === -1);
      assert(parseIp('192.256.1.1') === -1);
      assert(parseIp('256.168.1.1') === -1);
      assert(parseIp('256.168.1.-1') === -1);
    });

    it('correctly parses well-formed IP addresses', () => {
      assert(parseIp('192.168.0.1') === 0xc0a80001);
      assert(parseIp('127.0.0.1') === 0x7f000001);
      assert(parseIp('1.1.1.1') === 0x01010101);
      assert(parseIp('8.8.8.8') === 0x08080808);
    });
  });

  describe('isIpInRange', () => {
    it('correctly detects if IP is in range', () => {
      assert(isIpInRange(0xabadcafe, [0x00000000, 0x00000000]));
      assert(isIpInRange(0x7f000001, [0x7f000000, 0xff000000]));
      assert(isIpInRange(0xc0a80001, [0xc0a80000, 0xffff0000]));
      assert(isIpInRange(0xc0a80101, [0xc0a80100, 0xffffff00]));
      assert(isIpInRange(0xdeadbeef, [0xdeadbeef, 0xffffffff]));
    });

    it('correctly detects if IP is outside of range', () => {
      assert(!isIpInRange(0xaaaaaaaa, [0xdeadbeef, 0xffffffff]));
      assert(!isIpInRange(0xaaaaaaaa, [0x7f000000, 0xff000000]));
      assert(!isIpInRange(0xaaaaaaaa, [0xc0a80000, 0xffff0000]));
    });
  });

  describe('isLocalIp', () => {
    it('correctly detects if IP is a private network or loopback address', () => {
      assert(isLocalIp(0x00000000));
      assert(isLocalIp(0x7fabcdef));
      assert(isLocalIp(0x0aabcdef));
      assert(isLocalIp(0xc0a8abcd));
      assert(isLocalIp(0xac1abcde));
    });

    it('correctly detects if IP is not a private network or loopback address', () => {
      assert(!isLocalIp(0x00abcdef));
      assert(!isLocalIp(0x01010101));
      assert(!isLocalIp(0x01000001));
      assert(!isLocalIp(0x08080808));
      assert(!isLocalIp(0x08080404));
    });
  });
});
