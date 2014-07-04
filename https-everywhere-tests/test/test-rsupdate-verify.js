// Test the signature verification of the sha256 hash of update.json

const { Cc, Ci, Cu } = require('chrome');
const { atob, btoa} = Cu.import('resource://gre/modules/Services.jsm', {});

const PUBKEY = '' +
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmjKxzFnKCXiyRYKi4gKN'+
  'OJQjGKgeMXTwTZeKSD0vfNJnXQfJS4irxZ6O5EcKpgOY0zAp3QcotKA4S4GSLRXv'+
  'H3erwfh6b/HOGMELbi/Lm2cLiZFkWjZDagVyJ6D6mJdrv6kGho8CrrkeLm4kSiXV'+
  '089+nnxdn7E/ZWJLF0vb1oCqkxqPUGtgFbBQ0/sr0FmtPBTY+f5Ps4t3+9iB2bli'+
  '02lFYWSaYhhIDUClE/28JVbmlhJZOWrOZ+KgsKrsvgQ/oJ5KQdfwB2mD7qq7Qh5/'+
  'D2lBHFMFe0CU3HKq95UuWacIQ+iEXMCq10G4mFWB3YcyMRvtudVCWSrMIOruG+B2'+
  'PwIDAQAB';

const UPDATE_JSON = '' +
  '{"branch": "stable"\n'+
  ',"changes": "Generating some new data again"\n'+
  ',"date": "04-07-2014"\n'+
  ',"hash": "edc03d4985d37da1c23039b815c56d4f78931dfa668a1e2530af3c8c3357"\n'+
  ',"hashfn": "sha256"\n'+
  ',"source": "https://eff.org/files/https-everywhere/ruleset.sqlite"\n'+
  ',"version": "3.5.3.2"}\n';

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
    '9234260c8285fcd940a74a58078985d09b74f4bf97b77ae36f8f6c6fbd774282',
    'Test that the update.json data hashed to the right value');
  assert.equal(typeof verifier, 'object', 'Test verifier creation success');
  assert.ok(verifier.verifyData(hashed, UPDATE_JSON_SIG, PUBKEY),
    'Test that the update.json raw data is authentic');
};

require('sdk/test').run(exports);
