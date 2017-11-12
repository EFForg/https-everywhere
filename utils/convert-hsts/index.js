'use strict';

const _ = require('highland');
const fs = require('fs');
const https = require('https');
const JSONStream = require('JSONStream');
const base64 = require('base64-stream');
const xmlBuilder = require('xmlbuilder');

function hostToRegex(host) {
  return host.replace(/\./g, '\\.');
}

_(push => {
  https.get('https://chromium.googlesource.com/chromium/src/net/+/master/http/transport_security_state_static.json?format=TEXT', res => {
    push(null, res);
    push(null, _.nil);
  });
})
  .flatMap(_)
  .pipe(_.pipeline(
    base64.decode(),
    _.split(),
    _.filter(line => !/^\s*\/\//.test(line)),
    JSONStream.parse('entries.*')
  ))
  .reduce({
    xml: xmlBuilder.create('rulesetlibrary'),
    rulesets: new Map(),
    greedyInclusions: '(?!)',
    potentialExclusions: new Map()
  }, (acc, { name, mode = '', include_subdomains = false }) => {
    if (mode === 'force-https') {
      const ruleset = acc.xml.ele('ruleset', { name });
      acc.rulesets.set(name, ruleset);
      ruleset.ele('target', {
        host: name
      });
      if (include_subdomains) {
        acc.greedyInclusions += `|${hostToRegex(name)}`;
        ruleset.ele('target', {
          host: `*.${name}`
        });
      }
      ruleset.ele('rule', {
        from: '^http:',
        to: 'https:'
      });
    } else {
      acc.potentialExclusions.set(name, include_subdomains);
    }
    return acc;
  })
  .map(acc => {
    const regexp = new RegExp(`\.(${acc.greedyInclusions})$`);
    for (const [ name, include_subdomains ] of acc.potentialExclusions) {
      const match = name.match(regexp);
      if (match) {
        const ruleset = acc.rulesets.get(match[1]);
        ruleset.ele('exclusion', {
          pattern: `^http://${include_subdomains ? '(?:[\\w-]+\\.)*' : ''}${hostToRegex(name)}/`
        });
        ruleset.ele('test', {
          url: `http://${name}/`
        });
        if (include_subdomains) {
          ruleset.ele('test', {
            url: `http://host-part.${name}/`
          });
        }
      }
    }
    return acc.xml.end({ pretty: true });
  })
  .pipe(fs.createWriteStream(`${__dirname}/hsts.xml`));
