"use strict";

const { Octokit } = require('@octokit/rest');
const utils = require('./utils');
const axios = require('axios');
const unzip = require('unzipper');
const config = require('./config');
const token = config.github_token || process.env.GITHUB_TOKEN;

const octokit = new Octokit({
  auth: token,
  userAgent: 'Labeller v2'
});
const httpse = {
  owner: config.github_user,
  repo: config.github_repo
}

let ProgressBar = require('progress');

// Background process functions for logic flow below
let Utils = new utils.Utils(octokit, httpse);

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

/**
 * @param {obj} alexa
 * @description Returns Pull Requests to label
 */
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

/**
 * @param {obj} alexa
 * @param {obj} prs
 * @description Labels Pull Requests
 */
function process_prs(alexa, prs) {
  let filtered_prs = prs.filter(Utils.labelled);

  prs.forEach(pr => {

    let domain_label_pairs = [];

    octokit.pulls.listFiles({
      ...httpse,
      pull_number: pr.number,
    }).then(files => {
      let rank_number = Utils.files(files, alexa);
      if(rank_number !== null) {
        let determined_label = Utils.return_label(rank_number);
        // pr is interchangeable with issue in API ¯\_(ツ)_/¯
        Utils.add_label(determined_label, pr.number);
      }
    })
  });
}

initiate();
