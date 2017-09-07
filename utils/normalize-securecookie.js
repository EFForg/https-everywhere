'use strict'

const crypto = require('crypto')

const fs = require('fs')

const path = require('path')

const util = require('util')

const readFile = util.promisify(fs.readFile)

const writeFile = util.promisify(fs.writeFile)

const readdir = util.promisify(fs.readdir)

const regexes = [
  {
    from: /<securecookie\s+(host|name)=\s*["']\^?\.[+*]?\$?["']\s+(host|name)=\s*["']\^?\.[+*]?\$?["']\s*\/>/g,
    to: '<securecookie host=".+" name=".+" />'
  },
  {
    from: /<securecookie\s+host=\s*["'](.+)["']\s+name=\s*["']\^?\.[+*]?\$?["']\s*\/>/g,
    to: '<securecookie host="$1" name=".+" />'
  },
  {
    from: /<securecookie\s+name=\s*["']\^?\.[+*]?\$?["']\s+host=\s*["'](.+)["']\s*\/>/g,
    to: '<securecookie host="$1" name=".+" />'
  },
  {
    from: /<securecookie\s+host=\s*["']\^?\.[+*]?\$?["']\s+name=\s*["'](.+)["']\s*\/>/g,
    to: '<securecookie host=".+" name="$1" />'
  },
  {
    from: /<securecookie\s+name=\s*["'](.+)["']\s+host=\s*["']\^?\.[+*]?\$?["']\s*\/>/g,
    to: '<securecookie host=".+" name="$1" />'
  }
]

function parseWhitelist (data) {
  const lines = data.split('\n').slice(1)
  const result = {}

  for (const line of lines) {
    const lineSplit = line.split(',')

    if (lineSplit.length !== 4) continue

    const key = lineSplit[3].toLowerCase()

    const value = lineSplit[0]

    result[key] = value
  }

  return result
}

const rulesDir = path.resolve(__dirname, '../src/chrome/content/rules')
const rulesetWhitelistFile = path.join(__dirname, 'ruleset-whitelist.csv')

async function main () {
  const rulesetWhitelistContents = await readFile(rulesetWhitelistFile, 'utf8')
  let rulesetWhitelistNewContents = rulesetWhitelistContents

  const rulesetWhitelist = parseWhitelist(rulesetWhitelistContents)

  const files = (await readdir(rulesDir)).filter(name => name.endsWith('.xml')).sort()
  let changedCount = 0

  for (const fileName of files) {
    const fileNameLowerCase = fileName.toLowerCase()

    const file = path.join(rulesDir, fileName)

    const originalContents = await readFile(file, 'utf8')

    let fixHash = false
    let originalHash

    if (fileNameLowerCase in rulesetWhitelist) {
      originalHash = crypto.createHash('sha256').update(originalContents).digest('hex')

      if (rulesetWhitelist[fileNameLowerCase] === originalHash) {
        fixHash = true
      }
    }

    let newContents = originalContents

    for (const regex of regexes) {
      newContents = newContents.replace(regex.from, regex.to)
    }

    if (newContents !== originalContents) {
      if (fixHash) {
        const newHash = crypto.createHash('sha256').update(newContents).digest('hex')
        rulesetWhitelistNewContents = rulesetWhitelistNewContents.replace(originalHash, newHash)

        console.log(`"${fileName}" has been modified, its new hash is "${newHash}".`)
      } else {
        console.log(`"${fileName}" has been modified.`)
      }

      await writeFile(file, newContents, 'utf8')

      changedCount++
    }
  }

  console.log(`${changedCount} of ${files.length} files have changed (${changedCount / files.length * 100}%).`)

  if (rulesetWhitelistNewContents !== rulesetWhitelistContents) {
    await writeFile(rulesetWhitelistFile, rulesetWhitelistNewContents, 'utf8')

    console.log('Ruleset whitelist has been updated.')
  }
}

main()
