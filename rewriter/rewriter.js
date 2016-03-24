// HTTPS Rewriter.
//
// Uses the rulesets from HTTPS to recursively rewrite URL references in a
// given directory to HTTPS. Uses protocol-relative URLs wherever possible.
// Makes a copy of each file at filename.bak.
//
// Usage:
//  cd https-everywhere
//  ./makecrx.sh # to build default.rulesets
//  cd rewriter
//  (install node and npm)
//  npm install
//  node rewriter.js ~/path/to/my/webapp
//  cd ~/path/to/my/webapp
//  git diff

var path = require("path"),
    fs = require("fs"),
    DOMParser = require('xmldom').DOMParser,
    readdirp = require('readdirp'),
    es = require('event-stream'),

    rules = require("../chromium/rules"),

    URI = require("URIjs");

var ruleSets = new rules.RuleSets({});

/**
 * For a given directory, recursively edit all files in it that match a filename
 * pattern representing source code. Replace URLs in those files with rewritten
 * ones if possible.
 */
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
    // Optionally call stream.destroy() here in order to abort and cause 'close' to be emitted
  })
  .on('error', function (err) { console.error('fatal error', err); })
  .pipe(es.mapSync(function (entry) {
    var filename = path.join(dir, entry.path);
    try {
      processFile(filename);
    } catch(e) {
      console.log(filename, e);
    }
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
      console.log('Rewrote', url, 'in', filename);
      return rewritten;
    } else {
      return url;
    }
  });

  fs.writeFileSync(filename + ".new", rewrittenFile);
  fs.renameSync(filename, filename + ".bak");
  fs.renameSync(filename + ".new", filename);
}

/**
 * Load all rulesets for rewriting.
 */
function loadRuleSets(filename) {
  console.log("Loading rules from", filename);
  var fileContents = fs.readFileSync(filename, 'utf8');
  var xml = new DOMParser().parseFromString(fileContents, 'text/xml');
  ruleSets.addFromXml(xml);
}

function usage() {
  console.log("Usage:\n   nodejs rewriter.js /path/to/my/webapp\n");
  process.exit(1);
}

if (process.argv.length <= 2) {
  usage();
}

for (var i = 2; i < process.argv.length; i++) {
  var rewritePath = process.argv[i];
  if (rewritePath.indexOf('-') == 0) {
    usage();
  }
  if (!fs.existsSync(rewritePath)) {
    console.log("Path doesn't exist: " + rewritePath);
    process.exit(1);
  }
}

var hstsFilename = path.join(__dirname, 'hsts.xml');
try {
  fs.statSync(hstsFilename);
} catch (e) {
  console.error('hsts.xml not found. Run hsts-transform.js.');
  return;
}
loadRuleSets(hstsFilename);

loadRuleSets(path.join(__dirname, '../pkg/crx/rules/default.rulesets'));
for (var i = 2; i < process.argv.length; i++) {
  processDir(process.argv[i]);
}
