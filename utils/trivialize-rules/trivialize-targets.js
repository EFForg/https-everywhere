'use strict';

const util = require('util');
const path = require('path');
const xml2js = require('xml2js');

const fs = require('graceful-fs');
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const parseString = util.promisify(xml2js.parseString);

const chalk = require('chalk');
const validUrl = require('valid-url');
const escapeStringRegexp = require('escape-string-regexp');
const { explodeRegExp, UnsupportedRegExp } = require('./explode-regexp');

const rulesDir = `${__dirname}/../../src/chrome/content/rules`;

(async () => {
  const filenames = (await readdir(rulesDir)).filter(fn => fn.endsWith('.xml'));
  const filePromises = filenames.map(async filename => {
    const createTag = (tagName, colour, print) => {
      return (strings, ...values) => {
        let result = `[${tagName}] ${chalk.bold(filename)}: ${strings[0]}`;
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

    let content = await readFile(path.join(rulesDir, filename), 'utf8');
    const { ruleset } = await parseString(content);

    const rules = ruleset.rule.map(rule => rule.$);
    const targets = ruleset.target.map(target => target.$.host);

    // make sure ruleset contains at least one left wildcard targets
    if (!targets.some(target => target.startsWith('*.'))) {
      return;
    }

    // but does not contain right widcard targets
    if (targets.some(target => target.endsWith('.*'))) {
      return;
    }

    // should not contain trivial rules
    if (rules.some(rule => rule.from === '^http:' && rule.to === 'https:')) {
      return;
    }

    const ruleToIsSimpleMap = new Map();
    const ruleToIsSnappingMap = new Map();

    const targetToSupportedExplodedDomainsMap = new Map();

    const explodedDomains = new Set();
    const unsupportedExplodedDomains = new Set();
    const unusedTargets = new Set();

    // (1) We check if all rules can be exploded to valid urls
    //     (a) if true, continue to (2)
    //     (b) if we cannot trivialize targets for this ruleset, skip
    const isExplosiveRewrite = rule => {
      const explodedUrls = new Array();

      try {
        explodeRegExp(rule.from, url => explodedUrls.push(url));
      } catch (e) {
        // we are getting into runtime error, log and exit
        if (!(e instanceof UnsupportedRegExp)) {
          fail(e.message);
          process.exit(1);
        }
        return false;
      }

      // make sure each exploded URL is valid
      if (!explodedUrls.every(url => validUrl.isUri(url))) {
        return false;
      }

      let isSimpleToAllExplodedUrls = true;
      let isSnappingToSomeExplodedUrls = false;

      for (const url of explodedUrls) {
        const { protocol, hostname, pathname } = new URL(url);

        // if a rule do not rewrite all path for any URL, it is not a simple rule
        // i.e. a rule is simple only if it rewrite all path for all URLs
        if (!(protocol === 'http:' && pathname === '/*')) {
          isSimpleToAllExplodedUrls = false;
        }

        // if a rule is snapping to any URL, it is a snapping rule
        // where a rule is snapping to a URL if it change the domain
        // e.g. <rule from="^https://www\.example\.com/" to="https://example.com/" />
        if (
          url.replace(new RegExp(rule.from), rule.to) !==
          url.replace(/^http:/, 'https:')
        ) {
          isSnappingToSomeExplodedUrls = true;
        }

        // store a collection of exploded domains globally
        explodedDomains.add(hostname);
      }

      ruleToIsSimpleMap.set(rule, isSimpleToAllExplodedUrls);
      ruleToIsSnappingMap.set(rule, isSnappingToSomeExplodedUrls);
      return true;
    }

    if (!rules.every(isExplosiveRewrite)) {
      return;
    }

    // (2) We check if all the exploded domains are covered by the targets
    //     (a) if true, continue to (3)
    //     (b) some exploded domains are not covered by the targets,
    //         it is not safe to rewrite ruleset to include the
    //         exploded domains. skipping
    const isSupported = domain => {
      if (targets.includes(domain)) {
        // do not map non-wildcard targets to exploded domains
        // otherwise, it will introduce unnecessary rewrites
        targetToSupportedExplodedDomainsMap.delete(domain);
        return true;
      }

      // this part follows the implementation in rules.js
      const segments = domain.split('.');
      for (let i = 1; i <= segments.length - 2; ++i) {
        const tmp = '*.' + segments.slice(i, segments.length).join('.');
        if (targets.includes(tmp)) {
          targetToSupportedExplodedDomainsMap.get(tmp).push(domain);
          return true;
        }
      }
      unsupportedExplodedDomains.add(domain);
      return false;
    }

    // initially, assume each target doesn't support any exploded domain
    for (const target of targets) {
      targetToSupportedExplodedDomainsMap.set(target, [])
    }

    if (![...explodedDomains].every(domain => isSupported(domain))) {
      warn`ruleset rewrites domains ${[
        ...unsupportedExplodedDomains
      ]} unsupported by ${targets}`;
      return;
    }

    // (3) We check to make sure all targets are covered by rewrites
    //     (a) if true, continue to (4)
    //     (b) if some targets are not covered by any rewrites, this
    //         doesn't affect our works trivializing the targets, but
    //         we should give a warning and then proceed to (4)
    for (const target of targets) {
      const supportedExplodedDomains = targetToSupportedExplodedDomainsMap.get(
        target
      );
      if (supportedExplodedDomains && supportedExplodedDomains.length === 0) {
        // prepare the warning message here
        unusedTargets.add(target);
        // make sure we don't remove these targets when performing rewrites
        targetToSupportedExplodedDomainsMap.delete(target);
      }
    }

    if (unusedTargets.size > 0) {
      warn`ruleset contains targets ${[
        ...unusedTargets
      ]} not applied to any rewrites`;
    }

    // (4) Replace non-trivial targets with exploded domains
    let indent = null;

    for (const [key, value] of targetToSupportedExplodedDomainsMap) {
      const escapedKey = escapeStringRegexp(key);
      const regexSource = `\n([\t ]*)<target\\s*host=\\s*"${escapedKey}"\\s*?/>[\t ]*\n`;
      const regex = new RegExp(regexSource);

      const matches = content.match(regex);
      if (!matches) {
        // should be unreachable.
        warn`unexpected regular expression error`;
        process.exit(1);
      }

      [, indent] = matches;
      const sub =
        value.map(v => `\n${indent}<target host=\"${v}\" />`).join('') + '\n';
      content = content.replace(regex, sub);
    }

    // (5) Check if we can trivialize the rules. Need to satisfy all below conditions:
    //     i)   there is no unused target, i.e. unusedTargets.size == 0
    //     ii)  every rule is "simple" as in ruleToIsSimpleMap
    //     iii) at least one rule is a non-snapping rule
    //
    //     (a) if all of the conditions are met, append a trivial rule after all
    //         existing rules; and remove the non-snapping rules.
    //     (b) otherwise, do not trivialize the rules
    const condition1 = unusedTargets.size === 0;
    const condition2 = [...ruleToIsSimpleMap.entries()].every(
      ([, value]) => value
    );
    const condition3 = [...ruleToIsSnappingMap.entries()].some(
      ([, value]) => !value
    );

    if (condition1 && condition2 && condition3) {
      // append trivial rule to the end of current ruleset
      if ((content.match(/\n<\/ruleset>/) || []).length !== 1) {
        fail`ruleset contains zero or more than one </ruleset> tag`;
        return;
      } else {
        content = content.replace(
          /\n<\/ruleset>/,
          `\n${indent}<rule from="^http:" to="https:" />\n</ruleset>`
        );
      }

      // remove all non-snapping rules
      const nonSnappingRules = [...ruleToIsSnappingMap.entries()]
        .filter(([, value]) => value === false)
        .map(([key]) => key);

      for (const rule of nonSnappingRules) {
        const escapedRuleFrom = escapeStringRegexp(rule.from);
        const escapedRuleTo = escapeStringRegexp(rule.to);

        const regexSource = `\n([\t ]*)<rule\\s*from=\\s*"${escapedRuleFrom}"(\\s*)to=\\s*"${escapedRuleTo}"\\s*?/>[\t ]*\n`;
        const regex = new RegExp(regexSource);

        const matches = content.match(regex);
        if (!matches) {
          // should be unreachable.
          warn`unexpected regular expression error`;
          process.exit(1);
        }

        [, indent] = matches;
        content = content.replace(regex, '\n');
      }
    }

    return new Promise((resolve, reject) => {
      fs.writeFile(path.join(rulesDir, filename), content, 'utf8', err => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  });

  // use for-loop to await too many file opened error
  for (const fp of filePromises) {
    await fp.catch(error => console.log(error));
  }
})();
