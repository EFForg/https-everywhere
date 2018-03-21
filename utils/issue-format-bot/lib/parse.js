// Copyright 2017 AJ Jordan, AGPLv3+

// Takes in an issue body and parses it into key-value pairs, normalizes it, and returns an Object

'use strict';

const strip = require('strip-markdown'),
  remark = require('remark'),
  processor = remark().use(strip),
  _ = require('lodash'),
  domainFromPartialUrl = require('domain-from-partial-url'),
  Entities = require('html-entities').AllHtmlEntities,
  decode = (new Entities()).decode;

// XXX should type validation be moved to the validator module?
const validTypes = ['ruleset issue', 'new ruleset', 'code issue', 'feature request', 'other'];

// XXX the Error API in this module is pretty funky and could use a better design

module.exports = function parseDescription(body) {
  const plaintext = String(processor.processSync(body)); // eslint-disable-line no-sync

  // Check if there's no description at all
  if (plaintext.trim().length === 0) return new Error('null description');

  // Split by newlines, filter blanks, split into trimmed key-value and lowercase everything
  const lines = plaintext.split('\n')
    .filter(line => _.compact(line).length !== 0)
    .map(line => line.split(':').map(key => key.trim()))
    .map(line => [line[0].toLowerCase(), line[1]]);

  const types = lines.filter(line => line[0] === 'type');

  // XXX should we check for duplicates of *all* keys?
  if (types.length === 0) return new Error('no type');
  if (types.length > 1) return new Error('multiple types');

  // `types` looks like [ [ 'Type', 'ruleset issue' ] ]
  const type = types[0][1];

  if (!validTypes.includes(type)) return new Error('invalid type');

  // Convert to object
  const normalized = _.fromPairs(lines);

  // Markdown mangles full URLs into HTML entities
  // (e.g. `http&#x3A;//example.com/` instead of
  // `http://example.com/`). So we decode them again.
  if (normalized.domain) normalized.domain = domainFromPartialUrl(decode(normalized.domain));

  return normalized;
};
