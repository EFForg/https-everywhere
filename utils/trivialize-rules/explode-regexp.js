/* eslint-env es6, node */

const { parse } = require('regulex');

class UnsupportedRegExp extends Error {}

function explodeRegExp(re, callback) {
  (function buildUrls(str, items) {
    if (items.length === 0) {
      callback(str + '*');
      return;
    }

    let [first, ...rest] = items;

    if (first.repeat) {
      let repeat = first.repeat;
      if (repeat.max !== 1) throw new UnsupportedRegExp(first.raw);
      delete first.repeat;
      if (repeat.min === 0) {
        buildUrls(str, rest);
      }
      return buildUrls(str, items);
    }

    switch (first.type) {
      case 'group': {
        return buildUrls(str, first.sub.concat(rest));
      }

      case 'assert': {
        if (first.assertionType === 'AssertBegin') {
          if (str !== '*') return; // can't match begin not at the beginning
          return buildUrls('', rest);
        }
        if (first.assertionType === 'AssertEnd') {
          callback(str);
          return;
        }
        if (first.assertionType === 'AssertLookahead' && rest.length === 0) {
          return buildUrls(str, first.sub.concat(rest));
        }
        break;
      }

      case 'choice': {
        for (let branch of first.branches) {
          buildUrls(str, branch.concat(rest));
        }
        return;
      }

      case 'exact': {
        return buildUrls(str + first.chars, rest);
      }

      case 'charset': {
        if (first.ranges.length === 1) {
          let range = first.ranges[0];
          let from = range.charCodeAt(0);
          let to = range.charCodeAt(1);
          if (to - from < 10) {
            // small range, probably won't explode
            for (; from <= to; from++) {
              buildUrls(str + String.fromCharCode(from), rest);
            }
            first.ranges.length = 0;
          }
        }
        if (!first.classes.length && !first.exclude && !first.ranges.length) {
          for (let c of first.chars) {
            buildUrls(str + c, rest);
          }
          return;
        }
        break;
      }
    }

    throw new UnsupportedRegExp(first.raw);
  })('*', parse(re).tree);
};

module.exports = {
  UnsupportedRegExp,
  explodeRegExp
};
