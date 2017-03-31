"use strict";
const _ = require('highland');
const fs = require('fs');
const readDir = _.wrapCallback(fs.readdir);
const readFile = _.wrapCallback(fs.readFile);
const writeFile = _.wrapCallback(fs.writeFile);
const parseXML = _.wrapCallback(require('xml2js').parseString);
const ProgressBar = require('progress');
const VerEx = require('verbal-expressions');
let bar;

const rulesDir = `${__dirname}/../../src/chrome/content/rules`;

const hostPartRe = VerEx().anyOf(/\w\-/).oneOrMore();
const hostPartWithDotRe = VerEx().find(hostPartRe).then('\\.');

const staticRegExp = VerEx()
        .startOfLine()
        .then('^http://(')
        .beginCapture()
                .multiple(VerEx().find(hostPartWithDotRe).then('|'))
                .then(hostPartWithDotRe)
        .endCapture()
        .then(')')
        .beginCapture()
                .maybe('?')
        .endCapture()
        .beginCapture()
                .multiple(hostPartWithDotRe)
                .then(hostPartRe)
        .endCapture()
        .then('/')
        .endOfLine()
        .stopAtFirst()
        .searchOneLine();

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
  let pos;
  let re = createTagsRegexp(tag);
  source = source.replace(re, (match, index) => {
    if (pos === undefined) {
      pos = index;
    }
    return '';
  });
  if (pos === undefined) {
    throw new Error(`${re}: <${tag} /> was not found in ${source}`);
  }
  return source.slice(0, pos) + newXML + source.slice(pos);
}

const files =
        readDir(rulesDir)
        .tap(rules => {
          bar = new ProgressBar(':bar', { total: rules.length, stream: process.stdout });
        })
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
  bar.tick();

  let target = ruleset.target.map(target => target.$.host);
  let rule = ruleset.rule.map(rule => rule.$);

  if (rule.length === 1 && isTrivial(rule[0])) {
    return;
  }

  let targetRe = new RegExp(`^${target.map(target => `(${target.replace(/\./g, '\\.').replace(/\*/g, '.*')})`).join('|')}$`);
  let domains = [];

  function isStatic(rule) {
    if (isTrivial(rule)) {
      domains = domains.concat(target);
      return true;
    }

    const { from, to } = rule;

    const match = from.match(staticRegExp);

    if (!match) {
                        // console.error(from);
      return false;
    }

    const subDomains = match[1].split('|').map(item => item.slice(0, -2));
    const baseDomain = match[3].replace(/\\(.)/g, '$1');
    const localDomains = subDomains.map(sub => `${sub}.${baseDomain}`);

    if (to !== `https://$1${baseDomain}/`) {
      console.error(from, to);
      return false;
    }

    let mismatch = false;

    for (const domain of localDomains) {
      if (!targetRe.test(domain)) {
        console.error(target, domain, from);
        mismatch = true;
      }
    }

    if (mismatch) {
      return false;
    }

    if (match[2] || targetRe.test(baseDomain)) {
      localDomains.unshift(baseDomain);
    }

    domains = domains.concat(localDomains);

    return true;
  }

  if (!rule.every(isStatic)) return;

  domains = Array.from(new Set(domains));

  if (domains.slice().sort().join('\n') !== target.sort().join('\n')) {
    source = replaceXML(source, 'target', domains.map(domain => `<target host="${domain}" />`).join('\n\t'));
  }

  source = replaceXML(source, 'rule', '<rule from="^http:" to="https:" />');

  return writeFile(`${rulesDir}/${name}`, source);

})
.filter(Boolean)
.parallel(10)
.reduce(0, count => count + 1)
.each(count => console.log(`Rewritten ${count} files.`));
