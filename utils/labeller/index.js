"use strict";

const fs = require('fs');
const readline = require('readline');
const { Octokit } = require("@octokit/rest");
const _ = require('lodash');
const parseXML = require('xml2js').parseString;
const axios = require('axios');
const unzip = require('unzipper');
const config = require('./config');
const async = require('async');

const octokit = new Octokit({
  auth: config.github_token,
  userAgent: 'Labeller v2'
});
const httpse = {
  owner: config.github_user,
  repo: config.github_repo
}

let ProgressBar = require('progress');
let alexa_labels = ['top-1m', 'top-100k', 'top-10k', 'top-1k', 'top-100'];

// Processing functions
class Process {
  labelled(pr) {
    // Check if Alexa labels already applied
    let m = true;

    pr.labels.forEach(element => {
      if( alexa_labels.includes(element.name))
        m = false;
    });

    // Return filtered pull requests
    return m;
  }

  // look at files in PR
  files(files, alexa) {
    let rank;

    files.data.forEach(file => {
      if(file.filename.match(/^src\/chrome\/content\/rules\//) !== null){

        // Look at PR changes directly
        let matches = file.patch.match(/((host)="([^"]|"")*")/g);

        // strip to main domain
        if( matches !== null) {
          if( alexa.includes(matches[0].slice(6,-1))) {
            let index = (matches[0].slice(6,-1))
            rank = alexa.indexOf(index);
            return rank;
          }
        }
      }
    });
    if(rank) {
      return rank;
    } else {
      return null;
    }
  }

  // Get Alexa label
  return_label(rank_num) {
    let label;
    if(rank_num < 100){
      label = "top-100";
    } else if(rank_num < 1000){
      label = "top-1k";
    } else if(rank_num < 10000){
      label = "top-10k";
    } else if(rank_num < 100000){
      label = "top-100k";
    } else {
      label = "top-1m";
    }
    return label;
  }

  // Add Alexa Label
  add_label(chosen_label, pr_number) {
    octokit.issues.addLabels({
      ...httpse,
      issue_number: pr_number,
      labels: [chosen_label]
    });
  }
}

let process = new Process();

/**
 * @description Fetch the Alexa top 1M sites and push it to an array `alexa` via streams
 * @returns object
 */
function initiate() {

  let alexa = [];
  let regex = /^[0-9]+,(.+)/
  const alexa_csv = 'https://s3.amazonaws.com/alexa-static/top-1m.csv.zip';

  // Grab Alexa data
  axios({
    method: 'get',
    url: alexa_csv,
    responseType: 'stream'
  })
    .then(function (response) {
      response.data.pipe(unzip.Parse())
      .on('entry', function (entry) {
        let bar = new ProgressBar('Processing Alexa Top 1M [:bar] :percent :etas', {
          total: 100
        });

        let lineReader = require('readline').createInterface({
          input: entry,
        });

        let x = 0;

        lineReader.on('line', function (line) {
          let domain = line.match(regex)[1];
          alexa.push(domain);
          if(x % 10000 == 0) bar.tick();
          x++;
        });

        lineReader.on('close', function(){
          try {
            get_prs(alexa);
          } catch (error) {
            console.log(error);
          }
        });
      })
    })
    .catch(function (error) {
      console.log(error);
    });
}

function get_prs(alexa) {
  let wildcard_www_regex = /^(www|\*)\.(.+)/

  octokit.paginate(
    "GET /repos/:owner/:repo/pulls",
    httpse,
  )
  .then(prs => {
    process_prs(alexa, prs)
  })
  .catch(reason => {
    console.log(reason);
  })
}

function process_prs(alexa, prs) {
  let filtered_prs = prs.filter(process.labelled);

  prs.forEach(pr => {

    let domain_label_pairs = [];

    octokit.pulls.listFiles({
      ...httpse,
      pull_number: pr.number,
    }).then(files => {
      let rank_number = process.files(files, alexa);
      if(rank_number !== null) {
        let determined_label = process.return_label(rank_number);
        // pr is interchangeable with issue in API ¯\_(ツ)_/¯
        process.add_label(determined_label, pr.number);
      }
    })
  });
}

initiate();

module.exports = Process;