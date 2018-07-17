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
      let { repeat, ...firstSub } = first;
      if (repeat.max !== 1) throw new UnsupportedRegExp(first.raw);
      if (repeat.min === 0) {
        buildUrls(str, rest);
      }
      return buildUrls(str, [ firstSub, ...rest ]);
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
        if (first.excludes) {
          throw new UnsupportedRegExp(first.raw);
        }

        for (let cl of first.classes) {
          if (cl === 'd') {
            for (let i = '0'; i <= '9'; ++i) {
              buildUrls(str + i, rest);
            }
          } else {
            throw new UnsupportedRegExp(first.raw);
          }
        }

        for (let range of first.ranges) {
          let from = range.charCodeAt(0);
          let to = range.charCodeAt(1);

          if (to - from < 10) {
            for (; from <= to; ++from) {
              buildUrls(str + String.fromCharCode(from), rest);
            }
          } else {
            throw new UnsupportedRegExp(first.raw);
          }
        }

        for (const c of first.chars) {
          buildUrls(str + c, rest);
        }
        return ;
      }
    }

    throw new UnsupportedRegExp(first.raw);
  })('*', parse(re).tree);
};

module.exports = {
  UnsupportedRegExp,
  explodeRegExp
};
