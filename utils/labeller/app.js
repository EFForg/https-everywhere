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

// Utility functions stored here to not interupt flow of logic below
class tools {
   filter_labels(pr) {
    // Check if Alexa labels already applied
    let m = true;

    pr.labels.forEach(element => {
      if( alexa_labels.includes(element.name))
        m = false;
    });

    // Return filtered pull requests
    return m;
  }

  process_files(files, alexa) {
    // console.log(files);
    // console.log(alexa);
    hosts_labels = [];

    files.data.forEach(file => {
      if(file.filename.match(/^src\/chrome\/content\/rules\//) !== null){
        let matches = file.patch.match(/((host)="([^"]|"")*")/g);
        
      }
      //filtered_match.push()
    });
    // if(alexa.includes()){

    // }
  }
}
let utils = new tools();

/**
 * @description Fetch the Alexa top 1M sites and push it to an array `alexa` via streams
 * @returns object
 */
function get_alexa() {
  let alexa = [];
  let regex = /^[0-9]+,(.+)/
  const alexa_csv = 'https://s3.amazonaws.com/alexa-static/top-1m.csv.zip';

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
  let filtered_prs = prs.filter(utils.filter_labels);

  prs.forEach(pr => {

    let domain_label_pairs = [];

    octokit.pulls.listFiles({
      owner: httpse.owner,
      repo: httpse.repo,
      pull_number: pr.number,
    }).then(files => {
      domain_label_pairs = utils.process_files(files, alexa);
    })
  });
}

get_alexa();


