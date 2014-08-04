// Test the signature verification of the sha256 hash of update.json

const { Cc, Ci, Cu } = require('chrome');
const { atob, btoa} = Cu.import('resource://gre/modules/Services.jsm', {});

const PUBKEY = ''+
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7wJz/Ekn4loB+GX/TnObTo"+
  "/5J0/aq1hBl+xeSyCUX/fggjju5jnRnbnQx10OaZ655Yft4Cs2IfdIh95NYsN+gfi6"+
  "HVesy/Q9G72BjhpW6+gTlkW9vW56xwjv+Cpi5/20SKbvMZCMXTvR50HqLaLiOeLyAO"+
  "Qv06FKlyF5kbgQwpayExii75KFJL3HlH5+mZfNfKElNK9Oyiig7sqnVTOdovNCFnW8"+
  "zom2fS3YyODaFvPUSmo1Yd7Mr0xWjE5rAV7k70aZlR1NEze/Tfcf42LEhY5XkflczI"+
  "Wh+cse/v/sbZadS9jxbD2SgEJuLatF5zupmd0acvj1II8do2RE95FQCQIDAQAB";

const UPDATE_JSON = '' +
  '{"branch": "development"\n'+
  ',"changes": "Still trying to get signature verification working"\n'+
  ',"date": "04-08-2014"\n'+
  ',"hash": "8476a3638e2e95b6381aba4367e8c1c0f361bdaed501cd2f6f91b74e4545"\n'+
  ',"hashfn": "sha256"\n'+
  ',"source": "http://0.0.0.0:8000/data/rulesets.sqlite"\n'+
  ',"version": "5.0.0.1"}\n';

const UPDATE_JSON_SIG = '' +
  "MIIBFDANBgkqhkiG9w0BAQUFAAOCAQEAXzVK9wHhSEPPWKmUkX47v8fIMFivMqU7Bx"+
  "nDPaApc9CpJdC6xT8RT5Hp2Ajus1bWrYFaj7FoEht47TFZHUouWl/l6KDFaUOfxhnc"+
  "6eet+uly+gqdnO5NQZxftnRUmeG3nbipy9hRzkskBpRGCKrtS95vJQXlFN3ugkTcKm"+
  "anGlAfIZIBL14Mz+NgS7syznGwddv3zn0elldncDv6t5RdxkuvXRpnOOY2GYe2ijbE"+
  "a4UHrQc6O5xlCYAKM/8ABuA6yAs/RetnuC56NtF7DgM9bDAXHv29BPeG2GEgImg8Jf"+
  "LJS9Ck91SxA9Q4kaOCgHmkd/AI5qxEm2FMfgzsT+8VAA=="; 

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
    '8476a3638e2e95b6381aba4367e8c1c0f361bdaed501cd2f6f91b74e4545',
    'Test that the data was parsed into JSON properly');
};

exports['test update JSON signature validity'] = function(assert) {
  let hashed = hashSHA256(UPDATE_JSON);
  let verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                   .createInstance(Ci.nsIDataSignatureVerifier);
  assert.equal(hashed,
    'e05c92fcb9ed93344d8f5e9b358e64f7e0ab13eb8cd3a6fce2581f1d8cc73832',
    'Test that the update.json data hashed to the right value');
  assert.equal(typeof verifier, 'object', 'Test verifier creation success');
  assert.ok(verifier.verifyData(hashed, UPDATE_JSON_SIG, PUBKEY),
    'Test that the update.json raw data is authentic');
};

exports['test ruleset version comparison'] = function(assert) {
  let vcmp = Cc['@mozilla.org/xpcom/version-comparator;1']
               .createInstance(Ci.nsIVersionComparator);
  assert.ok(vcmp.compare('3.5.2', '3.5.2') === 0,
    'Test that equal version numbers are confirmed equal by version comparator');
  assert.ok(vcmp.compare('4.0development.17', '3.5.3') > 0,
    'Test that 4.0development.17 > 3.5.3');
  assert.ok(vcmp.compare('3.5.3.1', '3.5.3.2') < 0,
    'Test that ruleset version 3.5.3.2 > 3.5.3.1');
};

require('sdk/test').run(exports);
