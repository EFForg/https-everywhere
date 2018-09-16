'use strict';

let util = require('util');
let path = require('path');
let xml2js = require('xml2js');

let fs = require('graceful-fs');
let readdir = util.promisify(fs.readdir);
let readFile = util.promisify(fs.readFile);
let parseString = util.promisify(xml2js.parseString);

const rulesDir = 'src/chrome/content/rules';

const isTrivial = (securecookie) => {
  return securecookie.host === '.+' && securecookie.name === '.+';
}

(async () => {
  let readFilePromises = null;

  await readdir(rulesDir)
    .then(filenames => {
      return filenames.filter(filename => filename.endsWith('.xml'));
    })
    .then(filenames => {
      readFilePromises = filenames.map(async (filename) => {
        let content = null;

        return readFile(path.join(rulesDir, filename), 'utf8')
          .then(body => {
            content = body;
            return parseString(content);
          })
          .then(ruleset => ruleset.ruleset)
          .then(ruleset => {
            let rules = ruleset.rule.map(rule => rule.$);
            let targets = ruleset.target.map(target => target.$.host);
            let securecookies = ruleset.securecookie ? ruleset.securecookie.map(sc => sc.$) : null;

            if (!(rules && rules.length == 1)) {
              return ;
            }

            if (securecookies && securecookies.length == 1 && !isTrivial(securecookies[0])) {
              let securecookie = securecookies[0];
              if (!securecookie.host.endsWith('$')) {
                return ;
              }

              if (!securecookie.host.startsWith('^.+') && !securecookie.host.startsWith('^.*')) {
                return ;
              }

              let hostRegex = new RegExp(securecookie.host);
              for (let target of targets) {
                if (target.includes('.*')) {
                  return ;
                }

                target = target.replace('*.', 'www.')
                if (!hostRegex.test(target)) {
                  return ;
                }
              }

              let scReSrc = `\n([\t ]*)<securecookie\\s*host=\\s*"([^\"]+)"(\\s*)name=\\s*"([^\"]+)"\\s*?/>[\t ]*\n`;
              let scRe = new RegExp(scReSrc);
              let source = content.replace(scRe, '\n$1<securecookie host=".+"$3name="$4" />\n');

              fs.writeFileSync(path.join(rulesDir, filename), source, 'utf8');
            }
          })
      })
    })
    .catch(error => {
      console.log(error);
    })

  await Promise.all(readFilePromises)
    .catch(error => {
      console.log(error);
    });
})();
