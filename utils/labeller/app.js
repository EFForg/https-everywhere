"use strict";

const fs = require('fs');
const readline = require('readline');
const { Octokit } = require("@octokit/rest");
const _ = require('lodash');
const parseXML = require('xml2js').parseString;
const axios = require('axios');
const unzip = require('unzipper');
let ProgressBar = require('progress');
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

class Labeller {
}

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

function get_prs(alexa){
  let wildcard_www_regex = /^(www|\*)\.(.+)/

  octokit.paginate(
    "GET /repos/:owner/:repo/pulls",
    httpse,
  )
  .then(prs => {
    process_prs(alexa, prs)
  });
}

function process_prs(alexa, prs){
  console.log(typeof alexa);
  console.log(typeof prs);
}

get_alexa();


