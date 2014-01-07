var lrucache = require("./lru");
var rules = require("./rules");
var rules = require("./rules");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

function getRuleXml() {
    var xhr = new XMLHttpRequest();
    // Use blocking XHR to ensure everything is loaded by the time
    // we return.
    xhr.open("GET", "file:///home/jsha/https-everywhere/chromium/rules/default.rulesets", false);
    xhr.send(null);
    // Get file contents
    if (xhr.readyState != 4) {
      return "yy";
    }
    return xhr.responseXML;
}

new rules.RuleSets("foo", lrucache.LRUCache,
  getRuleXml());
console.log("ok");
