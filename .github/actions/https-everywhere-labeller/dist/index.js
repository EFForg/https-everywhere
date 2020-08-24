module.exports =
/******/ (function(modules, runtime) { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete installedModules[moduleId];
/******/ 		}
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	__webpack_require__.ab = __dirname + "/";
/******/
/******/ 	// the startup function
/******/ 	function startup() {
/******/ 		// Load entry module and return exports
/******/ 		return __webpack_require__(287);
/******/ 	};
/******/
/******/ 	// run startup
/******/ 	return startup();
/******/ })
/************************************************************************/
/******/ ({

/***/ 58:
/***/ (function(module) {

module.exports = require("readline");

/***/ }),

/***/ 122:
/***/ (function(module) {

module.exports = eval("require")("unzipper");


/***/ }),

/***/ 287:
/***/ (function(__unusedmodule, __unusedexports, __webpack_require__) {

"use strict";


const core = __webpack_require__(435);
const github = __webpack_require__(984);
const axios = __webpack_require__(396);
const unzip = __webpack_require__(122);
const context = github.context;
const minimatch = __webpack_require__(870);
const rulesetGlob = 'src/chrome/content/rules/*.xml';

let ProgressBar = __webpack_require__(578);
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

      let lineReader = __webpack_require__(58).createInterface({
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
  const token = core.getInput('github-token', { required: true });
  const client = new github.GitHub(token);
  const pR = context.payload.pull_request;

  try {
    const prNumber = pR.number

    pR.labels.forEach(element => {
      if( alexaLabels.includes(element.name))
        return;
    });

    const response = await client.pulls.listFiles({
      ...context.repo,
      pull_number: prNumber
    })
    const fileList = response.data

    fileList.forEach(file => {
      if(minimatch(file.filename, rulesetGlob)){
        console.log('Passed file match');

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
              client.issues.addLabels({
                ...context.repo,
                issue_number: prNumber,
                labels: [determined_label]
              });
            }
          }
        }
      } else {
        console.log('failed file match, exiting');
      }
    });
  } catch (err) {
    core.error(err.stack)
    core.setFailed(err.message)
  }
}


/***/ }),

/***/ 396:
/***/ (function(module) {

module.exports = eval("require")("axios");


/***/ }),

/***/ 435:
/***/ (function(module) {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 578:
/***/ (function(module) {

module.exports = eval("require")("progress");


/***/ }),

/***/ 870:
/***/ (function(module) {

module.exports = eval("require")("minimatch");


/***/ }),

/***/ 984:
/***/ (function(module) {

module.exports = eval("require")("@actions/github");


/***/ })

/******/ });