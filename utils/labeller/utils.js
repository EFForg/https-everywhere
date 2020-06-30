'use strict';

// Process Functions for Labeller
const alexa_labels = ['top-1m', 'top-100k', 'top-10k', 'top-1k', 'top-100'];

class Utils {
  constructor(octokit, httpse) {
    this.octokit = octokit;
    this.httpse = httpse;
  }

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
    this.octokit.issues.addLabels({
      ...this.httpse,
      issue_number: pr_number,
      labels: [chosen_label]
    });
  }
}

module.exports = {
  Utils: Utils
}
