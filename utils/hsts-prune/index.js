"use strict";

const _ = require('highland');
const fs = require('fs');
const read_dir = _.wrapCallback(fs.readdir);
const read_file = _.wrapCallback(fs.readFile);
const write_file = _.wrapCallback(fs.writeFile);
const unlink = _.wrapCallback(fs.unlink);
const parse_xml = _.wrapCallback(require('xml2js').parseString);
const async = require('async');
const https = require('https');
const http = require('http');
const request = require('request');
const split = require('split');
const JSONStream = require('JSONStream');
const base64 = require('base64-stream');
const filter = require('stream-filter');
const ProgressBar = require('progress');
const escape_string_regexp = require('escape-string-regexp');

const stable_version_url = "https://download.mozilla.org/?product=firefox-latest&os=linux64&lang=en_US";
const esr_version_url = "https://download.mozilla.org/?product=firefox-esr-latest&os=linux64&lang=en_US";
const chromium_version_url = "https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm";
const rules_dir = `${__dirname}/../../src/chrome/content/rules`;

let bar;

let rulesets_changed;
if('RULESETS_CHANGED' in process.env){
  rulesets_changed = process.env.RULESETS_CHANGED.split("\n");
  for(let i in rulesets_changed){
    let split_path = rulesets_changed[i].split("/");
    rulesets_changed[i] = split_path[split_path.length - 1];
  }
}

// Here begins the process of fetching HSTS rules and parsing the from the
// relevant URLs

const firefox_version_fetch = version_url => {
  return cb => {
    https.get(version_url, res => {
      cb(null, res.headers.location
        .match(/firefox-(.*).tar.*/)[1].replace(/\./g, "_"));
    });
  };
};

const chromium_version_fetch = version_url => {
  return cb => {
    _(request.get(version_url))
      .on('error', err => {
        cb(err);
      })
      .on('data', data => {
        cb(null, String(data).match(/google-chrome-stable-([0-9\.]+)/)[1]);
      })
      .pull(_ => _);
  }
};


const parse_include = include_url => {
  let regex = RegExp(/ "(.+?)", (true|false) /);

  return cb => {
    let hsts = {};
    request.get(include_url)
      .on('error', err => {
        cb(err);
      })
      .pipe(split())
      .on('data', line => {
        line = line.replace(new RegExp('^([^,]+), 1'), ' \"$1\", true ');
        line = line.replace(new RegExp('^([^,]+), 0'), ' \"$1\", false ');

        let regex_res = line.match(regex)
        if(regex_res){
          hsts[regex_res[1]] = Boolean(regex_res[2])
        }
      })
      .on('end', _ => {
        cb(null, hsts);
      });
  };
};

const parse_json = json_url => {
  return cb => {
    let hsts = {};
    request.get(json_url)
      .on('error', err => {
        cb(err);
      })
      .pipe(base64.decode())
      .pipe(split())
      .pipe(filter(line => {
        return !String(line).match(/\/\//);
      }))
      .pipe(JSONStream.parse('entries.*'))
      .on('data', entry => {
        if(entry.mode == "force-https"){
          hsts[entry.name] = entry.include_subdomains;
        }
      })
      .on('end', _ => {
        cb(null, hsts);
      });
  };
}

const check_inclusion = (structs, domain) => {
  if(domain in structs.esr &&
     domain in structs.dev &&
     domain in structs.stable &&
     domain in structs.chromium){
    return [true, domain];
  } else {
    let fqdn_shards = domain.split('.');
    for(let x = 1; x < fqdn_shards.length; x++){
      let recombined_fqdn = fqdn_shards.slice(x).join('.');
      if(structs.esr[recombined_fqdn] == true &&
         structs.dev[recombined_fqdn] == true &&
         structs.stable[recombined_fqdn] == true &&
         structs.chromium[recombined_fqdn] == true){
        return [true, recombined_fqdn];
      }
    }
  }
  return [false, null];
}

const check_header_directives = (check_domain, cb) => {
  let sent_callback = false;
  https.get('https://' + check_domain, res => {
    if('strict-transport-security' in res.headers){
      let preload = Boolean(
        res.headers['strict-transport-security'].match(/preload/i));
      let include_subdomains = Boolean(
        res.headers['strict-transport-security'].match(/includesubdomains/i));
      let max_age_match =
        res.headers['strict-transport-security'].match(/max-age=([0-9]+)/i)
      let max_age;
      if(max_age_match){
        max_age = Number(max_age_match[1]);
      }
      cb(null,
        preload && include_subdomains && max_age >= 10886400);
      sent_callback = true;
    } else {
      cb(null, false);
      sent_callback = true;
    }
  }).on('error', err => {
    if(!sent_callback){
      cb(null, false);
    }
  });
};

const check_https_redirection_and_header_directives = (check_domain, cb) => {
  let sent_callback = false;
  http.get('http://' + check_domain, res => {
    let escaped_check_domain = escape_string_regexp(check_domain);
    let check_domain_regex = RegExp(`^https://${escaped_check_domain}`, 'i');
    if(Math.floor(res.statusCode / 100) == 3 &&
       'location' in res.headers &&
       res.headers.location.match(check_domain_regex)){
      check_header_directives(check_domain, cb);
    } else {
      cb(null, false);
      sent_callback = true;
    }
  }).on('error', err => {
    if(!sent_callback){
      check_header_directives(check_domain, cb);
    }
  });
};


// Here we begin parsing the XML files and modifying the targets

function remove_target_from_xml(source, target) {
  let pos;
  // escape the regexp for targets that have a *
  target = escape_string_regexp(target);

  const target_regex = RegExp(`\n[ \t]*<target host=\\s*"${target}"\\s*/>\\s*?\n`);

  if(!source.match(target_regex)){
    throw new Error(`${target_regex} was not found in ${source}`);
  }
  return source.replace(target_regex, "\n");
}

const files =
  read_dir(rules_dir)
    .tap(rules => {
      bar = new ProgressBar(':bar', { total: rules.length, stream: process.stdout });
    })
    .sequence()
    .filter(name => {
      if(rulesets_changed){
        return ~rulesets_changed.indexOf(name);
      } else {
        return name.endsWith('.xml');
      }
    });

const sources =
  files.fork()
    .map(name => read_file(`${rules_dir}/${name}`, 'utf-8'))
    .parallel(10);

const rules =
  sources.fork()
    .flatMap(parse_xml)
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

// This async call determines the current versions of the supported browsers

async.parallel({
  stable: firefox_version_fetch(stable_version_url),
  esr: firefox_version_fetch(esr_version_url),
  chromium: chromium_version_fetch(chromium_version_url)
}, (err, versions) => {
  versions.esr_major = versions.esr.replace(/_.*/, "");

  let stable_url = `https://hg.mozilla.org/releases/mozilla-release/raw-file/FIREFOX_${versions.stable}_RELEASE/security/manager/ssl/nsSTSPreloadList.inc`;
  let dev_url = `https://hg.mozilla.org/releases/mozilla-beta/raw-file/tip/security/manager/ssl/nsSTSPreloadList.inc`;
  let esr_url = `https://hg.mozilla.org/releases/mozilla-esr${versions.esr_major}/raw-file/FIREFOX_${versions.esr}_RELEASE/security/manager/ssl/nsSTSPreloadList.inc`;
  let chromium_url = `https://chromium.googlesource.com/chromium/src.git/+/${versions.chromium}/net/http/transport_security_state_static.json?format=TEXT`;

  // This async call fetches and builds hash for the HSTS preloads included in
  // each of the supported browsers.

  async.parallel({
    esr: parse_include(esr_url),
    dev: parse_include(dev_url),
    stable: parse_include(stable_url),
    chromium: parse_json(chromium_url)
  }, (err, structs) => {

    files.fork().zipAll([ sources.fork(), rules ])
      .consume((err, ruleset_data, push, next) => {
        if(ruleset_data === _.nil){
          push(null, ruleset_data);
          return;
        }

        let [name, source, ruleset] = ruleset_data;
        if(!rulesets_changed){
          bar.tick();
        }

        let targets = ruleset.target.map(target => target.$.host);

        // First, determine whether the targets are included in the preload
        // list for all relevant browsers.  If at least one of them isn't, we
        // can't delete the file.  If any of them are, we need to perform
        // additional checks on the included domain.

        let can_be_deleted = true;
        let preload_check_mapping = {};
        for(let target of targets){
          let [included, included_domain] = check_inclusion(structs, target);
          if(included == false){
            can_be_deleted = false;
          } else {
            preload_check_mapping[included_domain] =
              preload_check_mapping[included_domain] || [];
            preload_check_mapping[included_domain].push(target);
          }
        }

        // Additional checks are as follows: curl the included domain, and if
        // the 'preload' directive is included, remove all targets that
        // correspond to that domain.  If the preload directive is absent, make
        // sure not to delete the file.
        //
        // Ref: https://github.com/EFForg/https-everywhere/pull/7081

        let checks = [];
        let source_overwritten = false;
        for(let included_domain in preload_check_mapping){
          checks.push(cb => {
            check_https_redirection_and_header_directives(
              included_domain, (err, meets_header_requirements) => {
                if(err) return cb(err);
                if(meets_header_requirements){
                  for(let target of preload_check_mapping[included_domain]){
                    console.log(`Removing ${target} from ${name}`);
                    source = remove_target_from_xml(source, target);
                    source_overwritten = true;
                  }
                } else {
                  can_be_deleted = false;
                }
                cb();
              }
            );
          });
        }

        // After building the additonal checks in the form of the
        // checks array of functions, run the checks in parallel and
        // perform the appropriate actions based on the results.

        async.parallel(checks, err => {
          if(err) return console.log(err);
          if(can_be_deleted){
            console.log(`All targets removed for ${name}, deleting file...`);
            push(null, unlink(`${rules_dir}/${name}`));
            next();
          } else {
            if(source_overwritten == false){
              push(null, false);
              next();
            } else {
              console.log(`Some targets removed for ${name}, overwriting file...`);
              push(null, write_file(`${rules_dir}/${name}`, source));
              next();
            }
          }
        });

      })
      .filter(Boolean)
      .parallel(10)
      .each(_ => _);
  });
});
