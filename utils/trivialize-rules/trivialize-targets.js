"use strict";

let util = require("util");
let path = require("path");
let xml2js = require("xml2js");

let fs = require("graceful-fs");
let readdir = util.promisify(fs.readdir);
let readFile = util.promisify(fs.readFile);
let parseString = util.promisify(xml2js.parseString);

let chalk = require("chalk");
let validUrl = require("valid-url");
let escapeStringRegexp = require("escape-string-regexp");
let { explodeRegExp, UnsupportedRegExp } = require("./explode-regexp");

let rulesDir = "src/chrome/content/rules";

(async () => {
  let filenames = (await readdir(rulesDir)).filter(fn => fn.endsWith(".xml"));
  let filePromises = filenames.map(async filename => {
    function createTag(tagName, colour, print) {
      return (strings, ...values) => {
        let result = `[${tagName}] ${chalk.bold(filename)}: ${strings[0]}`;
        for (let i = 1; i < strings.length; i++) {
          let value = values[i - 1];
          if (value instanceof Set) {
            value = Array.from(value);
          }
          value = Array.isArray(value) ? value.join(", ") : value.toString();
          result += chalk.blue(value) + strings[i];
        }
        print(colour(result));
      };
    }

    let warn = createTag("WARN", chalk.yellow, console.warn);
    let info = createTag("INFO", chalk.green, console.info);
    let fail = createTag("FAIL", chalk.red, console.error);

    let content = await readFile(path.join(rulesDir, filename), "utf8");
    let { ruleset } = await parseString(content);

    let rules = ruleset.rule.map(rule => rule.$);
    let targets = ruleset.target.map(target => target.$.host);

    // make sure ruleset contains at least one left wildcard targets
    if (!targets.some(target => target.includes("*."))) {
      return;
    }

    // but does not contain right widcard targets
    if (targets.some(target => target.includes(".*"))) {
      return;
    }

    // should not contain trivial rules
    if (rules.some(rule => rule.from === "^http:" && rule.to === "https:")) {
      return;
    }

    let rewriteDomains = new Set();
    let targetMappings = new Map();
    let unsupportedDomains = new Set();

    // note that "trivial" does not mean a trivial rule here
    function isTrivialRewrite(rule) {
      let retval = true;

      try {
        explodeRegExp(rule.from, url => {
          if (validUrl.isUri(url)) {
            let domain = new URL(url).hostname;
            rewriteDomains.add(domain);
            retval &= true;
          } else {
            retval = false;
          }
        });
      } catch (e) {
        // assume it is a non-trivial rewrite here
        return false;
      }
      return retval;
    }

    // skip ruleset if it contains non-trivial rewrites
    if (!rules.every(isTrivialRewrite)) {
      return;
    }

    // a one-to-many mapping between targets and rewrite domains
    for (let target of targets) {
      targetMappings.set(target, []);
    }

    function atLeastOneTargetCovered(domain) {
      if (targets.includes(domain)) {
        // avoid identity mapping messing up rewrites
        targetMappings.delete(domain);
        return true;
      }

      // follows the left wildcard matching rules in rules.js
      let parts = domain.split(".");
      for (let i = 1; i <= parts.length - 2; ++i) {
        let tmp = "*." + parts.slice(i, parts.length).join(".");
        if (targets.includes(tmp)) {
          targetMappings.get(tmp).push(domain);
          return true;
        }
      }
      return false;
    }

    for (let domain of rewriteDomains) {
      if (!atLeastOneTargetCovered(domain)) {
        unsupportedDomains.add(domain);
      }

      if (unsupportedDomains.size > 0) {
        warn`ruleset rewrite domains ${[
          ...unsupportedDomains
        ]} that are not covered by ${targets}`;
        return;
      }
    }

    targetMappings.forEach((value, key, map) => {
      let scReSrc = `\n([\t ]*)<target\\s*host=\\s*"${escapeStringRegexp(
        key
      )}"\\s*?/>[\t ]*\n`;
      let scRe = new RegExp(scReSrc);

      let matches = content.match(scRe);
      if (!matches) {
        // DEBUG ONLY. should be unreachable.
        warn`unexpected regular expression error`;
        return;
      }

      let [, indent] = matches;
      let sub =
        value.map(v => `\n${indent}<target host=\"${v}\" />`).join("") + "\n";
      content = content.replace(scRe, sub);
    });

    return new Promise((resolve, reject) => {
      fs.writeFile(path.join(rulesDir, filename), content, "utf8", err => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  });

  // use for-loop to await too many file opened error
  for (let fp of filePromises) {
    await fp.catch(error => console.log(error));
  }
})();
