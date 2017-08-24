// Copyright 2017 AJ Jordan, AGPLv3+

'use strict';

const vows = require('perjury'),
  assert = vows.assert;

function missingRequiredDomain(type) {
  return 	{
    topic: function(validate) {
      return validate({
        type
      });
    },
    'it returns an array': function(err, problems) {
      assert.ifError(err);
      assert.isArray(problems);
    },
    'the array has only one problem': function(err, problems) {
      assert.equal(problems.length, 1);
    },
    'the array has a missing domain problem': function(err, problems) {
      assert.isTrue(problems[0].includes('missing domain'));
    }
  };
}

function hasRequiredDomain(type) {
  return 	{
    topic: function(validate) {
      return validate({
        type,
        domain: 'example.com'
      });
    },
    'it returns an array': function(err, problems) {
      assert.ifError(err);
      assert.isArray(problems);
    },
    'the array has no problems': function(err, problems) {
      assert.equal(problems.length, 0);
    }
  };
}

vows.describe('data validator module').addBatch({
  'When we require the module': {
    topic: function() {
      return require('../lib/validate');
    },
    'it works': function(err) {
      assert.ifError(err);
    },
    'it\'s a function': function(err, validate) {
      assert.isFunction(validate);
    },
    'and we pass it a new ruleset without a domain': missingRequiredDomain('new ruleset'),
    'and we pass it a ruleset issue without a domain': missingRequiredDomain('ruleset issue'),
    'and we pass it a new ruleset with a domain': hasRequiredDomain('new ruleset'),
    'and we pass it a ruleset issue with a domain': hasRequiredDomain('ruleset issue')
  }
}).export(module);
