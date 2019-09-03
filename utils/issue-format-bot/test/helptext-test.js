// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const vows = require('perjury'),
  assert = vows.assert;

vows.describe('help text constant module').addBatch({
  'When we require the module': {
    topic: function() {
      return require('../lib/helptext');
    },
    'it works': function(err) {
      assert.ifError(err);
    },
    'it\'s a string': function(err, helptext) {
      assert.isString(helptext);
    }
  }
}).export(module);
