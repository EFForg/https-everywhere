// Test the signature verification of the sha256 hash of update.json

const { Cc, Ci, Cu } = require('chrome');
const { atob, btoa} = Cu.import('resource://gre/modules/Services.jsm', {});

const PUBKEY = ''+
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwMH3pA27nFhz6BpLFB6B'+
  'wtuRPrfGVIlZ6R9gprfTUJEcZxqC0T2tzxBgQqjEJPeL61YIuXOqXNMsTmHjooxW'+
  'qeUPUiBqTeXuM3dz+XgL6sxfydN1IwiWYsdD0bQmN9/ixgOamzBKTYxAx+g5TalD'+
  'Dv+xeHcBpf0Htu0JZPTaZZtmclxS4LvZXlYJYkcnv04jP/nRd0W/u/d8SYFvayld'+
  'saSiV00+AuHeQwWM5fmMK7t8OlQzXWp7TwqyzFaSaRZnKtzMBdWxK4IzIMYg3T5h'+
  'YY76I3E0t9s2eqFOH9b4cVvsEFzJl9QOXRPeSGLoF1mTsdLKw1BK+7l7/gUd8ZbI'+
  'bwIDAQAB';

const UPDATE_JSON = '' +
  '{"branch": "stable"\n'+
  ',"changes": "Generating some new data again"\n'+
  ',"date": "04-07-2014"\n'+
  ',"hash": "edc03d4985d37da1c23039b815c56d4f78931dfa668a1e2530af3c8c3357"\n'+
  ',"hashfn": "sha256"\n'+
  ',"source": "https://eff.org/files/https-everywhere/ruleset.sqlite"\n'+
  ',"version": "3.5.3.2"}\n';

const UPDATE_JSON_SIG = '' +
  'MIIBFDANBgkqhkiG9w0BAQUFAAOCAQEApCzWF1KJ2GQno8CxFr6jUNJrPkxU/Wg5'+
  '9s3ikuOb3sXoXzW2FUFI2AdQtTI4b1WTRmphi+vERfxysY0kMhq1eoz+LL4NDQQm'+
  'fQro021QrIRTvku+MQVwp7E3eS52WS+F2hnuBVpA0t+Zm84v3Xpd6M/VdxkqyZPx'+
  'MttinAZtyn21tqEWaUF6Rle2VUBK7zAdxCGjXyMx2U9HRgYlwmmQuAXHl+GMNQgq'+
  'WL01d+2EjV35GlWcwhu4+k4/GjD7sZqiG4TSuokpBevZMWTu7K9tTtb9VmHX6bn+'+
  'rhVYXVXYCYtEooH4yJYKgyOLn/U4XReR969+sTXW7NbKG3hMMVUFOg==';

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
