'use strict';

/**
 * For future contributors, this script was written to trivialize a special
 * form of securecookie rules which is equal to trivial securecookie rule
 * under the current HTTPSe implementation. This allows trivialize-rules.js to
 * simplify rulesets otherwise impossible due to the lack of support of
 * unbounded wildcard RegExps in explode-regexp.js (by design).
 *
 * As stated in trivialize-rules.js, a securecookie rule works if there is an
 * existing rule covering the exact same domain.
 *
 * In particular, <securecookie host=".*example.com" .../> covers all
 * subdomains in cookie.host given at least one working rule cover
 * the same subdomains.
 *
 * If there is at least one such rule, for e.g. www.example.com, the mentioned
 * securecookie rules can be reduced to
 *     <securecookie host="^\.?www\.example\.com$" .../>
 * Else, the securecookie rule do not take into effect and thus can be ignored
 * during the runtime.
 *
 * So, regardless of the existence of any rule, for all targets listed in a
 * ruleset, the securecookie rule can be interpreted as
 *     <securecookie host=".+" .../>
 *
 * For simplicity, this implementation require securecookie#host includes a
 * tailing $
 */

let util = require('util');
let path = require('path');
let xml2js = require('xml2js');

let fs = require('graceful-fs');
let readdir = util.promisify(fs.readdir);
let readFile = util.promisify(fs.readFile);
let parseString = util.promisify(xml2js.parseString);

const rulesDir = 'src/chrome/content/rules';

const isTrivial = securecookie => {
  return securecookie.host === '.+' && securecookie.name === '.+';
};

(async () => {
  let readFilePromises = null;

  await readdir(rulesDir)
    .then(filenames => {
      return filenames.filter(filename => filename.endsWith('.xml'));
    })
    .then(filenames => {
      readFilePromises = filenames.map(async filename => {
        let content = null;

        return readFile(path.join(rulesDir, filename), 'utf8')
          .then(body => {
            content = body;
            return parseString(content);
          })
          .then(ruleset => ruleset.ruleset)
          .then(ruleset => {
            let targets = ruleset.target.map(target => target.$.host);
            let securecookies = ruleset.securecookie
              ? ruleset.securecookie.map(sc => sc.$)
              : [];

            // make sure there is at least one non-trivial securecookie
            if (!securecookies.length || securecookies.some(isTrivial)) {
              return;
            }

            for (let securecookie of securecookies) {
              if (securecookie.name !== '.+') {
                return;
              }

              if (
                !securecookie.host.startsWith('^.+') &&
                !securecookie.host.startsWith('^.*') &&
                !securecookie.host.startsWith('.+') &&
                !securecookie.host.startsWith('.*') &&
                !securecookie.host.startsWith('(?:.*\\.)?') &&
                !securecookie.host.startsWith('(?:.+\\.)?') &&
                !securecookie.host.startsWith('^(?:.*\\.)?') &&
                !securecookie.host.startsWith('^(?:.+\\.)?')
              ) {
                return;
              }
            }

            // make sure each domains and its subdomains are covered by at least
            // one securecookie rule
            let securedDomains = new Map();
            for (let target of targets) {
              // we cannot handle the right-wildcards based on the argument above
              if (target.includes('.*')) {
                return;
              }
              if (target.includes('*.')) {
                target = target.replace('*.', 'www');
              }
              securedDomains.set(target, 0);
              securedDomains.set('.' + target, 0);
            }

            for (let securecookie of securecookies) {
              let pattern = new RegExp(securecookie.host);
              securedDomains.forEach((val, key, map) => {
                if (pattern.test(key)) {
                  map.set(key, val + 1);
                }
              });
            }

            let domains = [...securedDomains.keys()];
            if (!domains.every(key => securedDomains.get(key) > 0)) {
              return;
            }

            // remove the securecookie tag except the last one
            // replace the last securecookie tag with a trivial one
            let scReSrc = `\n([\t ]*)<securecookie\\s*host=\\s*"([^"]+)"(\\s*)name=\\s*"([^"]+)"\\s*?/>[\t ]*\n`;
            let scRe = new RegExp(scReSrc);

            let source = content;
            let occurrence = securecookies.length;
            while (occurrence > 0) {
              if (occurrence === 1) {
                source = source.replace(
                  scRe,
                  '\n$1<securecookie host=".+"$3name="$4" />\n'
                );
              } else {
                source = source.replace(scRe, '');
              }
              occurrence--;
            }
            fs.writeFileSync(path.join(rulesDir, filename), source, 'utf8');
          });
      });
    })
    .catch(error => {
      console.log(error);
    });

  await Promise.all(readFilePromises).catch(error => {
    console.log(error);
  });
})();
