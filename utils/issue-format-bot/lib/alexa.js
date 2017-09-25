// Copyright 2016 William Budington
// Copyright 2017 AJ Jordan
// AGPLv3+

'use strict';

const request = require('request'),
  unzip = require('unzip');

// (Heavily) modified from code by @Hainish in utils/labeller. Thanks, @Hainish!

// TODO make this return Promises
// TODO test this file

const DAY = 1000 * 60 * 60 * 24,
  obj = {data: null};

function retrieveAlexa(cb) {

  const alexa = [];
  const csvRegex = /^[0-9]+,(.+)/;

  request.get('https://s3.amazonaws.com/alexa-static/top-1m.csv.zip')
    .on('error', err => {
      cb(err);
    })
  // Dumb ESLint. It's not my fault this person named it like that!?
    .pipe(unzip.Parse()) // eslint-disable-line new-cap
    .on('entry', entry => {
      // TODO this use of readline is super confusing??
      const lineReader = require('readline').createInterface({
        input: entry
      });

      lineReader.on('line', line => {
        const domain = line.match(csvRegex)[1];
        alexa.push(domain);
      });

      lineReader.on('close', () => {
        cb(null, alexa);
      });
    });
}

module.exports = function getAlexa(log, cb) {
  // If the data has already been retrieved, just return it
  if (obj.data) {
    cb(null, obj);
    return;
  }

  // If it hasn't, invoke the retrieval function and schedule
  // refreshes if we don't run into problems
  retrieveAlexa((err, data) => {
    if (err) {
      cb(err, null);
      return;
    }

    log('Retrieved Alexa rankings.');

    // We return an object so that setInterval can change the Array
    // the `data` property points to
    obj.data = data;

    setInterval(retrieveAlexa, DAY, (_err, _data) => {
      // This is the callback function passed to retrieveAlexa()

      if (_err) {
        cb(_err, null);
        return;
      }

      obj.data = _data;

      log('Refreshed Alexa rankings.');
    });

    cb(null, obj);
  });
};
