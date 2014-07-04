// Test the signature verification of the sha256 hash of update.json

const { Cc, Ci, Cu } = require('chrome');
const { atob, btoa} = Cu.import('resource://gre/modules/Services.jsm', {});

const PUBKEY = ''+
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC2zPk2N6p2re361bqNCPmQRgaX'+
  '+CQcnrOa2OeQ0HfwEz/9uC1JmwToCYCqXLx4KDNUD9TXGTyN/y8QwpqTC9csFc+n'+
  'AUbg5gQ/YaL5Jt0n9H7iPr16aoB4BBX3T+yJLleaLSpoqRVpEtyx6XyogsXjJzbQ'+
  'PRskjDetZDTUc/6/pQIDAQAB';

const UPDATE_JSON = '' +
  '{"branch": "stable"\n'+
  ',"changes": "Generating some new data again"\n'+
  ',"date": "04-07-2014"\n'+
  ',"hash": "edc03d4985d37da1c23039b815c56d4f78931dfa668a1e2530af3c8c3357"\n'+
  ',"hashfn": "sha256"\n'+
  ',"source": "https://eff.org/files/https-everywhere/ruleset.sqlite"\n'+
  ',"version": "3.5.3.2"}\n';

const UPDATE_JSON_SIG = '' +
  'IS3xOEJZ3E5zsScccgqfmnESnobyHKwdi2o+27T3fTe7BgbynU/a5HdKgKOK2lNP'+
  '9MEeiijuPbLJ8XkbrYsxZ6ylg66fR4ZRRH8KOzny60UC/r9Pmhe8A85ciXnDapp/'+
  'Ryiaknk+nShRxD1QyqCXl6mP1ZyOG3oQoaIY2Ku7nNA=';

function hashSHA256(data) {
  let converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                    .createInstance(Ci.nsIScriptableUnicodeConverter);
  let hashing = Cc['@mozilla.org/security/hash;1']
                  .createInstance(Ci.nsICryptoHash);
  function toHexString(charCode) {
    return ('0' + charCode.toString(16)).slice(-2);
  }
  hashing.init(hashing.SHA256);
  converter.charset = 'UTF-8';
  let result = {};
  let converted = converter.convertToByteArray(data, result);
  hashing.update(converted, converted.length);
  let hashed = hashing.finish(false);
  return [toHexString(hashed.charCodeAt(i)) for (i in hashed)].join('');
}

function validUpdateData(updateHash, signature) {
  return Cc['@mozilla.org/security/datasignatureverifier;1']
           .createInstance(Ci.nsIDataSignatureVerifier)
           .verifyData(updateHash, signature, PUBKEY);
}

exports['test binary-base64 encoding'] = function(assert) {
  assert.strictEqual('hello', atob(btoa('hello')), 
    'Test that binary/base64 encoding works.');
};

/* This test is just meant to make sure that the object was parsed into JSON
 * properly and that the attributes of the object created can be read.
 */
exports['test update JSON parsing'] = function(assert) {
  let updateObj = JSON.parse(UPDATE_JSON);
  assert.equal(updateObj.hash, 
    'edc03d4985d37da1c23039b815c56d4f78931dfa668a1e2530af3c8c3357',
    'Test that the data was parsed into JSON properly');
};

exports['test update JSON signature validity'] = function(assert) {
  let hashed = hashSHA256(UPDATE_JSON);
  let verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                   .createInstance(Ci.nsIDataSignatureVerifier);
  assert.equal(hashed,
    '9234260c8285fcd940a74a58078985d09b74f4bf97b77ae36f8f6c6fbd774282',
    'Test that the update.json data hashed to the right value');
  assert.equal(typeof verifier, 'object', 'Test verifier creation success');
  assert.ok(verifier.verifyData(hashed, UPDATE_JSON_SIG, PUBKEY),
    'Test that the update.json raw data is authentic');
};

require('sdk/test').run(exports);
