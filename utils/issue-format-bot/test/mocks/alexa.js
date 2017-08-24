// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const SIZE = 1000;

const regex = /^domain(\d+).com$/;

function indexOf(str) {
  const match = regex.exec(str);

  if (match && Number(match[1]) <= SIZE) {
    return Number(match[1]) - 1;
  } else {

    /*
      ESLint is too dumb to realize that this always has a
      bound `this` from the Proxy, so it's not invalid;
      that Function#apply is clearer here than using
      Reflect.apply and isn't the usual overly verbose
      syntax people use; and that using `arguments` is
      clearer than using spread syntax (and is one of the
      rare cases where there isn't really a significant
      advantage to spread syntax). So we disable it for
      this line.

      TODO: report this upstream
    */

    /* eslint-disable */
    return Array.prototype.indexOf.apply(this, arguments);
    /* eslint-enable */
  }
}

const arr = new Proxy(new Array(SIZE), {
  get: function(target, name) {
    // Override Array#indexOf
    if (name === 'indexOf') {
      return indexOf.bind(target);
    }

    // Node REPL uses symbols apparently, which throw TypeErrors when isNaN coerces them, so do those first
    if (typeof name === 'symbol' || isNaN(name) || name >= SIZE) return target[name];
    return `domain${Number(name) + 1}.com`;
  }
});

module.exports = {data: arr};
