var path = require("path"),
    fs = require("fs"),
    DOMParser = require('xmldom').DOMParser,
    readdirp = require('readdirp'),
    es = require('event-stream'),

    lrucache = require("./lru"),
    rules = require("./rules"),

    URI = require("URIjs");

var ruleSets = null;

function processDir(dir) {
  var stream = readdirp({
    root: dir,
    fileFilter: '*.html'
  });

  stream
  .on('warn', function (err) { 
    console.error('non-fatal error', err); 
    // optionally call stream.destroy() here in order to abort and cause 'close' to be emitted
  })
  .on('error', function (err) { console.error('fatal error', err); })
  .pipe(es.mapSync(function (entry) {
    var filename = path.join(dir, entry.path);
    console.log("Rewriting " + filename);
    processFile(filename);
  }));
}

function processFile(filename) {
  var contents = fs.readFileSync(filename, {encoding: 'utf-8'});
  var rewrittenFile = URI.withinString(contents, function(url) {
    var uri = new URI(url);
    if (uri.protocol() != 'http') return url;

    uri.normalize();
    var rewritten = ruleSets.rewriteURI(uri.toString(), uri.host());
    if (rewritten) {
      // If the rewrite was just a protocol change, output protocol-relative
      // URIs.
      var rewrittenUri = new URI(rewritten).protocol('http');
      if (rewrittenUri.toString() === uri.toString()) {
        return rewrittenUri.protocol('').toString();
      } else {
        return rewritten;
      }
    } else {
      return url;
    }
  });

  fs.writeFileSync(filename + ".new", rewrittenFile);
  //fs.renameSync(filename, filename + ".bak");
  //fs.renameSync(filename + ".new", filename);
}

function loadRuleSets() {
  var fileContents = fs.readFileSync(path.join(__dirname, 'rules/default.rulesets'), {encoding: 'utf-8'});
  var xml = new DOMParser().parseFromString(fileContents, 'text/xml');
  ruleSets = new rules.RuleSets("fake user agent", lrucache.LRUCache, xml, {});
}

loadRuleSets();
for (var i = 2; i < process.argv.length; i++) {
  processDir(process.argv[i]);
}
