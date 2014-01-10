// HTTPS Rewriter.
//
// Uses the rulesets from HTTPS to recursively rewrite URL references in a
// given directory to HTTPS. Uses protocol-relative URLs wherever possible.
// Makes a copy of each file at filename.bak.
//
// Usage:
//  (install node and npm)
//  cd https-everywhere
//  ./makecrx.sh
//  cd rewriter
//  js rewriter.js ~/path/to/my/webapp

var path = require("path"),
    fs = require("fs"),
    DOMParser = require('xmldom').DOMParser,
    readdirp = require('readdirp'),
    es = require('event-stream'),

    lrucache = require("../chromium/lru"),
    rules = require("../chromium/rules"),

    URI = require("URIjs");

var ruleSets = null;

function processDir(dir) {
  var stream = readdirp({
    root: dir,
    fileFilter: ['*.html', '*.js', '*.rb', '*.erb', '*.mustache', 
                 '*.scala', '*.c', '*.cc', '*.cpp', '*.cxx',
                 '*.java', '*.go', '*.php', '*.css', '*.pl', '*.py',
                 '*.rhtml', '*.sh', '*.yaml']
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
  var contents = fs.readFileSync(filename, 'utf8');
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
  var fileContents = fs.readFileSync(path.join(__dirname, '../pkg/crx/rules/default.rulesets'), 'utf-8');
  var xml = new DOMParser().parseFromString(fileContents, 'text/xml');
  ruleSets = new rules.RuleSets("fake user agent", lrucache.LRUCache, xml, {});
}

loadRuleSets();
for (var i = 2; i < process.argv.length; i++) {
  processDir(process.argv[i]);
}
