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

    // a one-to-many mapping between targets and exploded domains
    let targetMappings = new Map();

    let explodedDomains = new Set();
    let unappliedTargets = new Set();
    let unsupportedDomains = new Set();

    function isExplosiveRewrite(rule) {
      let explosive = true;
      let { from, to } = rule;

      try {
        explodeRegExp(rule.from, url => {
          if (validUrl.isUri(url)) {
            let { hostname } = new URL(url);
            explodedDomains.add(hostname);
          } else {
            explosive = false;
          }
        });
      } catch (e) {
        if (!(e instanceof UnsupportedRegExp)) {
          fail`${e.message}`;
        }
        return false;
      }
      return explosive;
    }

    if (!rules.every(isExplosiveRewrite)) {
      return;
    }

    function isSupported(domain) {
      if (targets.includes(domain)) {
        // avoid identity mapping messing up rewrites
        targetMappings.delete(domain);
        return true;
      }

      let segments = domain.split(".");
      for (let i = 1; i <= segments.length - 2; ++i) {
        let tmp = "*." + segments.slice(i, segments.length).join(".");
        if (targets.includes(tmp)) {
          targetMappings.get(tmp).push(domain);
          return true;
        }
      }
      return false;
    }

    for (let target of targets) {
      targetMappings.set(target, []);
    }

    for (let domain of explodedDomains) {
      if (!isSupported(domain)) {
        unsupportedDomains.add(domain);
      }
    }

    if (unsupportedDomains.size > 0) {
      warn`ruleset rewrites domains ${[
        ...unsupportedDomains
      ]} that are not covered by ${targets}`;
    }

    for (let target of targets) {
      let mappings = targetMappings.get(target);
      if (mappings && mappings.length == 0) {
        // add targets to the list of targets not applied
        unappliedTargets.add(target);
        // do not rewrite targets which is not applied
        targetMappings.delete(target);
      }
    }

    if (unappliedTargets.size > 0) {
      warn`ruleset contains targets ${[
        ...unappliedTargets
      ]} not applied to any rule`;
    }

    // skip rewrite
    if (!targetMappings.size) {
      return;
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
