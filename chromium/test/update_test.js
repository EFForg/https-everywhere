'use strict'

const assert = require('chai').assert,
  update = require('../background-scripts/update'),
  chrome = require("sinon-chrome"),
  util = require('../background-scripts/util'),
  atob = require("atob"),
  TextDecoder = require('text-encoding').TextDecoder,
  sinon = require('sinon');

const fs = require('fs'),
  update_channels = Function(fs.readFileSync(__dirname + '/../background-scripts/update_channels.js').toString() + "return update_channels;")(),
  pako = Function(fs.readFileSync(__dirname + '/../external/pako-1.0.5/pako_inflate.min.js').toString() + "return pako;")();

util.setDefaultLogLevel(util.WARN);

describe('update.js', function() {
  const example_rulesets_gz = fs.readFileSync(__dirname + '/example.rulesets.gz');

  describe('applyStoredRulesets', function() {
    beforeEach(() => {
      chrome.flush();
      if(util.loadExtensionFile.restore){ util.loadExtensionFile.restore(); }
    });

    it('applies compressed rulesets from chrome.storage', function(done) {
      let apply_promises = [];

      for(let update_channel of update_channels){
        const key = 'rulesets: ' + update_channel.name;
        chrome.storage.local.get.withArgs(key).yields({[key]: example_rulesets_gz});
      }

      update.applyStoredRulesets({addFromJson: response => {
        apply_promises.push(new Promise(resolve => {
          assert.isArray(response);
          assert.equal(response[0].name, "Example.com");
          resolve();
        }));

        if(apply_promises.length == update_channels.length){
          Promise.all(apply_promises).then(() => done());
        }
      }});

    });

    it('applies rulesets from local extension file', function(done) {
      for(let update_channel of update_channels){
        const key = 'rulesets: ' + update_channel.name;
        chrome.storage.local.get.withArgs(key).yields({});
      }

      const example_rulesets_byte_array = pako.inflate(atob(example_rulesets_gz));
      const example_rulesets = new TextDecoder("utf-8").decode(example_rulesets_byte_array);
      const example_rulesets_json = JSON.parse(example_rulesets);

      sinon.stub(util, "loadExtensionFile").returns(example_rulesets_json.rulesets);

      update.applyStoredRulesets({addFromJson: response => {
        assert.isArray(response);
        assert.equal(response[0].name, "Example.com");
        done();
      }});
    });

  });

})
