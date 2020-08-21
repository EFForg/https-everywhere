'use strict'

const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const unzip = require('unzipper');
const context = github.context;
const minimatch = require('minimatch');
const rulesetGlob = new minimatch.Minimatch('/src/chrome/content/rules/*.xml');
console.log('say something, anything');

let ProgressBar = require('progress');
let alexaLabels = ['top-1m', 'top-100k', 'top-10k', 'top-1k', 'top-100'];
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
          run(alexa); // Intiates labelling
        } catch (error) {
          console.log(error);
        }
      });
    })
  })
  .catch(function (error) {
    console.log(error);
  });

function return_label(rank_num) {
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

// Label PR if Needed
async function run(alexa) {
  console.log('made it to run');
  console.log(alexa.length);
  const token = core.getInput('repo-token', { required: true });
  const octokit = new github.GitHub(token);
  const pR = context.payload.pull_request;
  console.log(pR);

  try {
    // if (context.payload.action !== 'opened' || !pR) {

    //   return
    // }

    const prNumber = pR.number
    console.log(pR.number);

    pR.labels.forEach(element => {
      if( alexaLabels.includes(element.name))
        return;
    });

    const response = await client.pulls.listFiles({
      ...context.repo,
      pull_number: prNumber
    })
    const fileList = response.data

    if (!fileList.every(file => rulesetGlob.match(file.name))) {
      // Don't touch PRs that modify anything except rulesets
      console.log('No ruleset files in this PR');
      return;
    } else {
      fileList.forEach(file => {
        if(rulesetGlob.match(file.name) !== null){

          // Look at PR changes directly
          let matches = file.patch.match(/((host)="([^"]|"")*")/g);

          // strip to main domain
          if( matches !== null) {
            if( alexa.includes(matches[0].slice(6,-1))) {
              let index = (matches[0].slice(6,-1))
              let rank = alexa.indexOf(index);

              if(rank !== null) {
                let determined_label = return_label(rank);
                console.log('labelling Pull Request');
                octokit.issues.addLabels({
                  ...context.repo,
                  issue_number: prNumber,
                  labels: [determined_label]
                });
              }
            }
          }
        }
      });
    }
  } catch (err) {
    core.error(err.stack)
    core.setFailed(err.message)
  }
}