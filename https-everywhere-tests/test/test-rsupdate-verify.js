// Test the signature verification of the sha256 hash of update.json

const { Cc, Ci, Cu } = require('chrome');
const { atob, btoa} = Cu.import('resource://gre/modules/Services.jsm', {});

const PUBKEY = '' +
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuBGrCtHS1L1wE0loA/ay'+
  'WpQHt7212x9yCNFo0YPHiWJhhIclxC4T7cy8MGyugjSn1h8dvPczF1iFrSDTFid8'+
  'nc5rBZMvmm1GfNJBjsxWssUtlSQowi/QWuBZIYIx/UF7euF0h25lBTGwzluTndPS'+
  '5VNoyg3O1Lipp5PmkU/hc4Xgdner8fCz/lsQhiYRiWmuR9NLBuzj38DHm67gamUz'+
  'gP8vatVToojR4hMB9iSOys3GjK5hrvyMeQTm0l9mQUc7KnJSBqRvzBS5kk1It4NZ'+
  'gKv6jYnh2d9BsX3Qit66DDGgKXhcFsTIntNGdUdh8R5EqL1v5K7A3tnfz73Yw9XO'+
  'kwIDAQAB';

const UPDATE_JSON = '' +
  '{"branch": "stable"\n'+
  ',"changes": "Testing the signature verification process"\n'+
  ',"date": "02-07-2014"\n'+
  ',"hash": "df1453c7116d3ebef93ab5ea79d693fdf0ea4eacc01cfa687418fa23319c36b"\n'+
  ',"hashfn": "sha256"\n'+
  ',"source": "https://eff.org/files/https-everywhere/ruleset.sqlite"\n'+
  ',"version": "3.5.2.2"}\n';

const UPDATE_JSON_SIG = '' +
  'b5B2vjy2efKWQ7VPVODrTjScnzF+PCoUALc4MOZFSoovCP2bVsANo9khWymsi5fF'+
  '466u5xOfmJwwY24v/GqdPtXDLVtT1HGBA4+CNFekQP7KnyZUpcjkNjcbnxWJftx/'+
  'OifqTFngcQqWLajqbCIhux6kIHc5bltn1aBDscV/MwDKn9kqmqQVjjkhYGehKN6X'+
  'iduWCY8gygv5OOF5GZGYYkaCLW5xqPphQ84d+ZY/18emDBzA6R16qfPM8jT7PzrN'+
  'IuIaMdZ3YjXF7dQbS7xo+gXYa/pQnCeYhGQKeomc0x4gfcQB9cJB/o++IZRPYFTP'+
  '6t59nUaCm2fSQGse/OairQ==';

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
    'df1453c7116d3ebef93ab5ea79d693fdf0ea4eacc01cfa687418fa23319c36b',
    'Test that the data was parsed into JSON properly');
};

exports['test update JSON signature validity'] = function(assert) {
  let hashed = hashSHA256(UPDATE_JSON);
  let verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                   .createInstance(Ci.nsIDataSignatureVerifier);
  assert.equal(hashed,
    '073fba85f17718a511aac4019ddd220f05b14adb99649c9fcbd78f0ba88b974c',
    'Test that the update.json data hashed to the right value');
  assert.equal(typeof verifier, 'object', 'Test verifier creation success');
  assert.ok(verifier.verifyData(hashed, UPDATE_JSON_SIG, PUBKEY),
    'Test that the update.json raw data is authentic');
};

require('sdk/test').run(exports);
