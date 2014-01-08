var fs = require("fs");
var DOMParser = require('xmldom').DOMParser;

var lrucache = require("./lru");
var rules = require("./rules");

var URI = require("URIjs");

var ruleSets = null;

function processFile() {
  fs.readFile('/home/jsha/index.html',
    {encoding: 'utf-8'},
    function (err, data) {
      if (err) throw err;
      var result = URI.withinString(data, function(url) {
        var uri = new URI(url);
        if (uri.protocol() != 'http') return url;

        uri.normalize();
        var rewritten = ruleSets.rewriteURI(uri.toString(), uri.host());
        if (rewritten) {
          console.log(uri.toString(), rewritten);
          return rewritten;
        } else {
          return url;
        }
      });
    });
}

fs.readFile('rules/default.rulesets',
  {encoding: 'utf-8'},
  function (err, data) {
  if (err) throw err;
  var xml = new DOMParser().parseFromString(data, 'text/xml');
  ruleSets = new rules.RuleSets("foo", lrucache.LRUCache, xml, {});
  console.log("ok");

  processFile();
});
