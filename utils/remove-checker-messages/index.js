"use strict";

const _ = require('highland');
const fs = require('fs');
const readDir = _.wrapCallback(fs.readdir);
const readFile = _.wrapCallback(fs.readFile);
const writeFile = _.wrapCallback(fs.writeFile);
const parseXML = _.wrapCallback(require('xml2js').parseString);
const ProgressBar = require('progress');

let bar;

const rulesDir = `${__dirname}/../../src/chrome/content/rules`;

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

files.fork().zipAll([ sources.fork(), rules ]).map(([name, source, ruleset]) => {
	bar.tick();

	let default_off = ruleset.$.default_off;

	// skip files which are not default_off
	if(typeof default_off !== 'undefined' && default_off) {
		return
	}

	// skip files which has never been disabled
	if(source.indexOf("Disabled by https-everywhere-checker because:") == -1) {
		return 
	} 

	let re1 = /Disabled by https-everywhere-checker because:\s*?\n((Fetch error|Non-2xx HTTP code):[^\n]*\n?)*/g
	let re2 = /<!--\s*-->/g
	let re3 = /--><ruleset/g

	source = source.replace(re1, "")
	source = source.replace(re2, "")
	source = source.replace(re3, "-->\n<ruleset")
	source = source.trimLeft("\t\r\n")

	return writeFile(`${rulesDir}/${name}`, source);
})
.filter(Boolean)
.parallel(10)
.reduce(0, count => count + 1)
.each(count => console.log(`Rewritten ${count} files.`));
