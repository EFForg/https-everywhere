"use strict";

var fs = require('fs');
var readline = require('readline');

var GitHubApi = require('github');
var _ = require('lodash');
var parseXML = require('xml2js').parseString;
var async = require('async');
var request = require('request');
var unzip = require('unzip');
var ProgressBar = require('progress');

var config = require('./config');

// Fetch the Alexa top 1M sites and push it to an array `alexa` via streams
function get_alexa(alexa_cb){

  var alexa = []
  var csv_regex = /^[0-9]+,(.+)/

  request.get('https://s3.amazonaws.com/alexa-static/top-1m.csv.zip')
    .on('error', function(err) {
      alexa_cb(err);
    })
    .pipe(unzip.Parse())
    .on('entry', function (entry) {

      var bar = new ProgressBar('Processing Alexa Top 1M [:bar] :percent :etas', {
        total: 100
      });

      var lineReader = require('readline').createInterface({
        input: entry
      });

      var x = 0;
      lineReader.on('line', function (line) {
        var domain = line.match(csv_regex)[1]
        alexa.push(domain);

        if(x % 10000 == 0) bar.tick();
        x++;
      });

      lineReader.on('close', function(){
        alexa_cb(null, alexa);
      });

    });
};

function get_most_recent_pr(alexa, recent_cb){
  fs.readFile(config.state_file, function(err, data){
    if(err){
      fs.writeFile(config.state_file, '0', function(err){
        if(err) return recent_cb(err);
        recent_cb(null, [alexa, 0]);
      });
    } else {
      recent_cb(null, [alexa, Number(data)]);
    }
  });
}

function github_process_prs(res, pr_cb){
  var alexa = res[0],
    most_recent_pr_checked = res[1];

  var github = new GitHubApi();
  var wildcard_www_regex = /^(www|\*)\.(.+)/

  var httpse = {
    user: config.github_user,
    repo: config.github_repo
  }

  github.authenticate({
    type: "oauth",
    token: config.github_token || process.env.GITHUB_TOKEN
  })

  // Label all PRs which meet the criteria for labelling
  function github_process_pr_page(first_page){
    return function(err, pull_requests){
      if(first_page){
        fs.writeFile(config.state_file, pull_requests[0].number, function(err){
          if(err) return pr_cb(err);
        });
      }

      _.each(pull_requests, function(pull_request){

        if(pull_request.number > most_recent_pr_checked){
          github.pullRequests.getFiles(_.extend(httpse, {
            number: pull_request.number
          }), function(err, files){
            if(err) return pr_cb(err);

            // Rank a list of target hosts, returning the minimum alexa placing
            function rank_targets(targets){
              var minimum_placing = 9999999;

              _.each(targets, function(host){
                if(host.match(wildcard_www_regex)){
                  host = host.match(wildcard_www_regex)[2];
                }

                var alexa_placing = alexa.indexOf(host);
                if(~alexa_placing && alexa_placing < minimum_placing){
                  minimum_placing = alexa_placing;
                }
              });

              if(minimum_placing != 9999999){
                return minimum_placing;
              }
            }

            // Given the url of an HTTPSE ruleset, return a list of targets to fetch_cb
            function fetch_url_and_parse_targets(url, fetch_cb){
              request({url: url}, function(err, res, body){
                if(err) return fetch_cb(err);

                parseXML(body, function(err, root){
                  if(err) return fetch_cb(err);

                  fetch_cb(null, _.map(root.ruleset.target, function(target){
                    return target.$.host;
                  }));
                });
              });
            }

            var file_fetches = [];

            // Out of the list of files for this PR, figure out the minimum Alexa ranking for each
            _.each(files, function(file){
              if(file.filename.match(/^src\/chrome\/content\/rules\//)){
                file_fetches.push(function(file_cb){
                  fetch_url_and_parse_targets(file.raw_url, function(err, targets){
                    if(err) return file_cb(err);

                    console.log("Processing PR: " + pull_request.number + ", file: " + file.filename);

                    var ranking = rank_targets(targets);
                    if(ranking){
                      return file_cb(null, {
                        alexa_placing: ranking,
                        pr_number: pull_request.number
                      });
                    } else {
                      return file_cb();
                    }
                  });
                });
              }
            });

            async.parallel(file_fetches, function(err, res){
              if(err) pr_cb(err);

              var reduced_pr_ranking =  _.reduce(_.filter(res),
                function(minimum_file_res, file_res){
                  if(file_res.alexa_placing < minimum_file_res.alexa_placing){
                    return file_res;
                  }
                  return minimum_file_res;
                });

              if(reduced_pr_ranking){
                let label;
                if(reduced_pr_ranking.alexa_placing < 100){
                  label = "top-100";
                } else if(reduced_pr_ranking.alexa_placing < 1000){
                  label = "top-1k";
                } else if(reduced_pr_ranking.alexa_placing < 10000){
                  label = "top-10k";
                } else if(reduced_pr_ranking.alexa_placing < 100000){
                  label = "top-100k";
                } else {
                  label = "top-1m";
                }
                console.log("Applying label `" + label + "` to PR: " + reduced_pr_ranking.pr_number);

                github.issues.addLabels(_.extend(httpse, {
                  number: reduced_pr_ranking.pr_number,
                  body: [label]
                }), function(err, res){
                  if(err) console.log(err);
                });
              }
            });
          });
        }
      });

      if(github.hasNextPage(pull_requests)){
        github.getNextPage(pull_requests, github_process_pr_page(false));
      }
    }
  }

  github.pullRequests.getAll(_.extend(httpse, {
    state: "open",
    per_page: 100
  }), github_process_pr_page(true));
}

async.waterfall([
  get_alexa,
  get_most_recent_pr,
  github_process_prs
], function(err, result){
  if(err) console.log(err);
});
