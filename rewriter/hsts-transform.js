// A tool to transform transport_security_state_static.json into one big trivial
// ruleset on stdout.
// To get transport_security_state_static.json:
// curl https://chromium.googlesource.com/chromium/src/+/master/net/http/transport_security_state_static.json?format=TEXT \
//  | base64 -d > transport_security_state_static.json
var fs = require('fs');

if (process.argv.length != 3) {
  console.error('Provide path to transport_security_state_static.json as only argument.');
  return;
}
var contents = fs.readFileSync(process.argv[2], 'utf8');
contents = contents.split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
var secStateStatic = JSON.parse(contents);
console.log('<ruleset name="hsts">')
secStateStatic.entries.forEach(function(entry) {
  if (entry.mode != "force-https") {
    return;
  }
  console.log('  <target host="' + entry.name + '" />');
  if (entry.include_subdomains) {
    console.log('  <target host="*.' + entry.name + '" />');
  }
});
console.log('  <rule from="^http:" to="https:" />');
console.log('</ruleset>');
