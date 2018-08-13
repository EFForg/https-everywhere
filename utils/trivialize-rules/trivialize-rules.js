/* eslint-env es6, node */

'use strict';

const _ = require('highland');
const fs = require('fs');
const readDir = _.wrapCallback(fs.readdir);
const readFile = _.wrapCallback(fs.readFile);
const writeFile = _.wrapCallback(fs.writeFile);
const parseXML = _.wrapCallback(require('xml2js').parseString);
const { explodeRegExp, UnsupportedRegExp } = require('./explode-regexp');
const escapeStringRegexp = require('escape-string-regexp');
const chalk = require('chalk');

const rulesDir = `${__dirname}/../../src/chrome/content/rules`;

const tagsRegExps = new Map();

function createTagsRegexp(tag) {
  let re = tagsRegExps.get(tag);
  if (!re) {
    const tagRe = `<${tag}(?:\\s+\\w+=".*?")*\\s*\\/>`;
    re = new RegExp(`(?:${tagRe}\\s*)*${tagRe}`, 'g');
    tagsRegExps.set(tag, re);
  }
  return re;
}

function replaceXML(source, tag, newXML) {
  let pos, indent;
  let re = createTagsRegexp(tag);

  source = source.replace(re, (match, index) => {
    if (source.lastIndexOf('<!--', index) > source.lastIndexOf('-->', index)) {
      // inside a comment
      return match;
    }
    if (pos === undefined) {
      pos = index;
      indent = source.slice(source.lastIndexOf('\n', index) + 1, index);
    }
    return '';
  });

  if (pos === undefined) {
    throw new Error(`${re}: <${tag} /> was not found in ${source}`);
  }

  return source.slice(0, pos) + newXML.join('\n' + indent) + source.slice(pos);
}

const files =
        readDir(rulesDir)
          .sequence()
          .filter(name => name.endsWith('.xml'));

const sources =
        files.fork()
          .map(name => readFile(`${rulesDir}/${name}`, 'utf-8'))
          .parallel(10);

const rules =
        sources.fork()
          .flatMap(parseXML)
          .errors((err, push) => {
            push(null, { err });
          })
          .zip(files.fork())
          .map(([ { ruleset, err }, name ]) => {
            if (err) {
              err.message += ` (${name})`;
              this.emit('error', err);
            } else {
              return ruleset;
            }
          });

function isTrivial(rule) {
  return rule.from === '^http:' && rule.to === 'https:';
}

files.fork().zipAll([ sources.fork(), rules ]).map(([name, source, ruleset]) => {
  function createTag(tagName, colour, print) {
    return (strings, ...values) => {
      let result = `[${tagName}] ${chalk.bold(name)}: ${strings[0]}`;
      for (let i = 1; i < strings.length; i++) {
        let value = values[i - 1];
        if (value instanceof Set) {
          value = Array.from(value);
        }
        value = Array.isArray(value) ? value.join(', ') : value.toString();
        result += chalk.blue(value) + strings[i];
      }
      print(colour(result));
    };
  }

  const warn = createTag('WARN', chalk.yellow, console.warn);
  const info = createTag('INFO', chalk.green, console.info);
  const fail = createTag('FAIL', chalk.red, console.error);

  let targets = ruleset.target.map(target => target.$.host);
  let securecookies = ruleset.securecookie ? ruleset.securecookie.map(sc => sc.$) : new Array();
  let rules = ruleset.rule.map(rule => rule.$);

  if (rules.length === 1 && isTrivial(rules[0])) {
    return;
  }

  let targetRe = new RegExp(`^(?:${targets.map(target => target.replace(/\./g, '\\.').replace(/\*/g, '.*')).join('|')})$`);
  let domains = new Set();

  function isStatic(rule) {
    if (isTrivial(rule)) {
      for (let target of targets) {
        domains.add(target);
      }
      return true;
    }

    const { from, to } = rule;
    const fromRe = new RegExp(from);
    let localDomains = new Set();
    let unknownDomains = new Set();
    let nonTrivialUrls = new Set();
    let suspiciousStrings = new Set();

    try {
      explodeRegExp(from, url => {
        let parsed = url.match(/^http(s?):\/\/(.+?)(?::(\d+))?\/(.*)$/);
        if (!parsed) {
          suspiciousStrings.add(url);
          return;
        }
        let [, secure, host, port = '80', path] = parsed;
        if (!targetRe.test(host)) {
          unknownDomains.add(host);
        } else if (!secure && port === '80' && path === '*' && url.replace(fromRe, to) === url.replace(/^http:/, 'https:')) {
          localDomains.add(host);
        } else {
          nonTrivialUrls.add(url);
        }
      });
    } catch (e) {
      if (!(e instanceof UnsupportedRegExp)) {
        throw e;
      }
      if (e.message === '/*' || e.message === '/+') {
        fail`Suspicious ${e.message} while traversing ${from} => ${to}`;
      } else {
        warn`Unsupported regexp part ${e.message} while traversing ${from} => ${to}`;
      }
      return false;
    }

    if (suspiciousStrings.size > 0) {
      fail`${from} matches ${suspiciousStrings} which don't look like URLs`;
    }

    if (unknownDomains.size > 0) {
      fail`${from} matches ${unknownDomains} which are not in targets ${targets}`;
    }

    if (suspiciousStrings.size > 0 || unknownDomains.size > 0) {
      return false;
    }

    if (nonTrivialUrls.size > 0) {
      if (localDomains.size > 0) {
        warn`${from} => ${to} can trivialize ${localDomains} but not urls like ${nonTrivialUrls}`;
      }
      return false;
    }

    for (let domain of localDomains) {
      domains.add(domain);
    }

    return true;
  }

  if (!rules.every(isStatic)) return;

  domains = Array.from(domains);

  // It is assumed that if all securecookies are static,
  // they can be safely ignored.
  //
  // A securecookie is called to be static either it is a trivial securecookie
  // or ALL of the following conditions are satisfied:
  //
  // 1. securecookie.host match cookie.host from the beginning ^ to the end $.
  // Otherwise, it might match subdomains/ partial patterns, thus a non-trivial
  // securecookie.
  //
  // 2. securecookie.host will not throw an error when passed to explodeRegExp().
  // Otherwise, it might match patterns too complicated for our interests.
  //
  // 3. Each exploded securecookie.host should be included in ruleset.target/
  // exploded target. Otherwise, this ruleset is likely problematic itself. It
  // is dangerous for a rewrite.
  function isStaticCookie(securecookie) {
    if (securecookie.host === '.+' && securecookie.name === '.+') {
      return [true, false];
    }

    if (!securecookie.host.startsWith('^') || !securecookie.host.endsWith('$')) {
      return [false, false];
    }

    let localDomains = new Set();
    let unsupportedDomains = new Set();

    try {
      explodeRegExp(securecookie.host, domain => {
        if (domain.startsWith('.')) {
          domain = domain.slice(1);
        }
        localDomains.add(domain);
      });
    } catch (e) {
      if (!(e instanceof UnsupportedRegExp)) {
        throw e;
      }
      warn`Unsupported regexp part ${e.message} while traversing securecookie : ${JSON.stringify(securecookie)}`;
      return [false, false];
    }

    for (const domain of localDomains) {
      if (domains.indexOf(domain) === -1) {
        warn`Ruleset does not cover target ${domain} for securecookie : ${JSON.stringify(securecookie)}`;
        unsupportedDomains.add(domain);
      }
    }

    // For cookies to be covered, there must be at least one rule covering the
    // same domain. This is guaranteed by safeToSecureCookie(cookie) in rules.js
    //
    // Since securecookie.host will only match cookie.domain if there there is
    // a rule covers cookie.domain. Given the target are trivial, cookie.domain
    // cannot be anything other than domain.example.com and .domain.example.com
    // (possibly with more leading dots) for a securecookie rule ever to take
    // place.
    //
    // With condition (1) effective, securecookie.host should explode to either
    // one of the aforementioned patterns. Otherwise, the securecookie rules
    // will never be applied. Such dangling securecookie rules can be removed
    // safely.
    if (unsupportedDomains.size > 0) {
      if (unsupportedDomains.size === localDomains.size) {
        return [true, true];
      }
      fail`Tag securecookie ${JSON.stringify(securecookie)} matches ${unsupportedDomains} which are not in targets ${targets}`;
    }
    return [true, false];
  }

  if (domains.slice().sort().join('\n') !== targets.sort().join('\n')) {
    // For each securecookie rule, check if it is a static securecookie.
    // If it is non-static, we do not trivialize the ruleset; Otherwise,
    // we remove the securecookie if it contain only unsupported hosts.
    // This removal is better done one by one to avoid side effects.
    // Else if ALL securecookie rules are static, trivialize the targets.
    for (const securecookie of securecookies) {
      let [isStatic, shouldRemove] = isStaticCookie(securecookie);

      if (isStatic) {
        if (shouldRemove) {
          let scReSrc = `\n([\t ]*)<securecookie\\s*host=\\s*"${escapeStringRegexp(securecookie.host)}"(\\s*)name=\\s*"${escapeStringRegexp(securecookie.name)}"\\s*?/>[\t ]*\n`;
          let scRe = new RegExp(scReSrc);
          source = source.replace(scRe, '');
        }
      } else {
        // Skip this ruleset as it contain non-static securecookies
        return;
      }
    }

    source = replaceXML(source, 'target', domains.map(domain => `<target host="${domain}" />`));
  }

  source = replaceXML(source, 'rule', ['<rule from="^http:" to="https:" />']);

  info`trivialized`;

  return writeFile(`${rulesDir}/${name}`, source);
})
  .filter(Boolean)
  .parallel(10)
  .reduce(0, count => count + 1)
  .each(count => console.log(`Rewritten ${count} files.`));
