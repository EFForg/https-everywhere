'use strict';

const assert = require('chai').assert;
const Process = require('./index.js');

describe('index.js', () => {
  describe('Process.return_label', () => {
    it('returns rank label', () => {
      let process = new Process();
      assert(process.return_label(89)     === 'top-100');
      assert(process.return_label(899)    === 'top-1k');
      assert(process.return_label(8999)   === 'top-10k');
      assert(process.return_label(89999)  === 'top-100k');
      assert(process.return_label(899999) === 'top-1m');
    });
  });
});

