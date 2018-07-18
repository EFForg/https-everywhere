'use strict'

const util = require('util')
const path = require('path')

const fs = require('graceful-fs')
const xml2js = require('xml2js')
const request = require('sync-request')
const chalk = require('chalk')

const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)
const parseXML = util.promisify(xml2js.parseString)

const rulesDir = 'src/chrome/content/rules/'

const log = (level, filename, message) => {
  switch (level) {
    case 'WARN':
      console.warn(chalk.yellow(`[${level}] ${chalk.bold(filename)}: ${message}`))
      break
    case 'INFO':
      console.info(chalk.green(`[${level}] ${chalk.bold(filename)}: ${message}`))
      break
    case 'FAIL':
    default:
      console.error(chalk.red(`[${level}] ${chalk.bold(filename)}: ${message}`))
      break
  }
}

const supportedCDNsRegexs = [
  { // Cloudfront.net
    fromRe: /^\^http(?:s\?)?:\/\/((([\\a-z0-9äö_-]+)\.)*([\\a-z0-9äö-]+))\/$/,
    toRe: /^https:\/\/\w+\.cloudfront\.net\/$/
  },
  { // 2o7.net
    fromRe: /^\^http(?:s\?)?:\/\/((([\\a-z0-9äö_-]+)\.)*([\\a-z0-9äö-]+))\/$/,
    toRe: /^https:\/\/[\w-]+\.1[12]2\.2o7\.net\/$/
  },
  { // amazonaws.com
    fromRe: /^\^http(?:s\?)?:\/\/((([\\a-z0-9äö_-]+)\.)*([\\a-z0-9äö-]+))\/$/,
    toRe: /^https:\/\/s3\.amazonaws\.com\//
  }
]

const escapeRegExp = (str) => {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&') // eslint-disable-line
}

const isSecureConnectionOkay = (host) => {
  // FIXME: terrible performance...
  let response = request('GET', `https://${host}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0'
    },
    timeout: 3000,
    socketTimeout: 3000,
    maxRedirects: 5
  })
  if (response) {
    return true
  } else {
    return false
  }
}

const trivializeGenericRewrites = async (fstat, content, rules) => {
  return new Promise((resolve, reject) => {
    let rewrittenAtLeastOnce = false
    let originalContent = content

    for (const rule of rules) {
      for (const supportedCDNsRegex of supportedCDNsRegexs) {
        if (supportedCDNsRegex.fromRe.test(rule.from) && supportedCDNsRegex.toRe.test(rule.to)) {
          let host = rule.from.replace(supportedCDNsRegex.fromRe, '$1').replace(/\\\./g, '.')

          if (host !== null && isSecureConnectionOkay(host)) {
            // TODO: replace rule here...
            const ruleRe = `\n([\t ]*)<rule\\s*from=\\s*"${escapeRegExp(rule.from)}"(\\s*)to=\\s*"${escapeRegExp(rule.to)}"\\s*?/>[\t ]*\n`
            const ruleRegex = new RegExp(ruleRe, 'g')

            if (ruleRegex.test(originalContent)) {
              content = content.replace(ruleRegex, `\n$1<rule from="^http://${host.replace(/\./g, '\\.')}/"$2to="https://${host}/" />\n`)
              if (originalContent !== content) {
                rewrittenAtLeastOnce = true
              }
            } else {
              log('WARN', fstat.filename, `Warning: cannot construct RegExp which match rule ${JSON.stringify(rule)}`)
            }
            break
          }
        }
      }
    }

    if (rewrittenAtLeastOnce) {
      try {
        fs.writeFileSync(fstat.fullname, content, { encoding: 'utf8' })
        resolve(rewrittenAtLeastOnce)
      } catch (error) {
        reject(error)
      }
    } else {
      resolve(rewrittenAtLeastOnce)
    }
  })
}

const trivializeCDNRewrites = async (fstat) => {
  return new Promise((resolve, reject) => {
    (async () => { // async wrapper for await keyword...
      let content = await readFile(fstat.fullname, { encoding: 'utf8' }).catch(error => reject(error))
      let $ = await parseXML(content).catch(error => reject(error))
      let rules = $.ruleset.rule.map(rule => rule.$)
      let rewrittenAtLeastOnce = false

      await trivializeGenericRewrites(fstat, content, rules)
        .then(rewritten => {
          if (rewritten) {
            rewrittenAtLeastOnce = true
          }
        })
        .catch(error => {
          reject(error)
        })

      // TODO: Add support for more CDNs
      resolve(rewrittenAtLeastOnce)
    })()
  })
}

(async () => {
  await readdir(rulesDir)
    .then(filenames => {
      return filenames.filter(filename => filename.endsWith('.xml'))
    })
    .then(filenames => {
      return filenames.map(filename => ({
        fullname: path.join(rulesDir, filename),
        filename
      }))
    })
    .then(async (fstats) => {
      return Promise.all(fstats.map(fstat => {
        return trivializeCDNRewrites(fstat)
          .then(rewritten => {
            if (rewritten) {
              log('INFO', fstat.filename, 'trivialized')
            }
          })
          .catch(error => {
            log('FAIL', fstat.filename, error)
          })
      }))
    })
    .catch(error => {
      log('FAIL', '::Promise.all::', error)
    })
})()
