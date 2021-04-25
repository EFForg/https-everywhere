'use strict';

(function (exports) {

/**
 * Parse and convert literal IP address into numerical IP address.
 * @param {string} ip
 * @returns {number}
 */
const parseIp = ip => {
  if (!/^[0-9.]+$/.test(ip)) {
    return -1;
  }

  /** @type {string[]} */
  const octets = ip.split('.');

  if (octets.length !== 4) {
    return -1;
  }

  let ipN = 0;

  for (const octet of octets) {
    if (octet === '') {
      return -1;
    }

    const octetN = parseInt(octet);

    if (octetN < 0 || octetN > 255) {
      return -1;
    }

    ipN = (ipN << 8) | octetN;
  }

  return ipN >>> 0;
};

/**
 * Check if the numeric IP address is within a certain range.
 * @param {number} ip
 * @param {number[]} range
 * @returns {boolean}
 */
const isIpInRange = (ip, [rangeIp, mask]) => (ip & mask) >>> 0 === rangeIp;

// A list of local IP address ranges
const localRanges = [
  [/* 0.0.0.0         */ 0x00000000, /* 255.255.255.255 */ 0xffffffff],
  [/* 127.0.0.0       */ 0x7f000000, /* 255.0.0.0       */ 0xff000000],
  [/* 10.0.0.0        */ 0x0a000000, /* 255.0.0.0       */ 0xff000000],
  [/* 172.16.0.0      */ 0xac100000, /* 255.240.0.0     */ 0xfff00000],
  [/* 192.168.0.0     */ 0xc0a80000, /* 255.255.0.0     */ 0xffff0000],
];

/**
 * Check if the numeric IP address is inside the local IP address ranges.
 * @param {number} ip
 * @returns {boolean}
 */
const isLocalIp = ip => localRanges.some(range => isIpInRange(ip, range));

Object.assign(exports, {
  parseIp,
  isIpInRange,
  isLocalIp
});

})(typeof exports !== 'undefined' ? exports : require.scopes.ip_utils = {});
