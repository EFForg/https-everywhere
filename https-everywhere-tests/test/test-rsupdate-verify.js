// Test the signature verification of the sha256 hash of update.json

const { Cc, Ci, Cu } = require('chrome');
const { atob, btoa} = Cu.import('resource://gre/modules/Services.jsm', {});

const PUBKEY = ''+
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqBMFDg+bPpGeAAqJ8v24Y9oHYuwtb'+
  'ZPtlwqWoUb9sdS8t6pPG6zpjnLVvDxk9PdJytsM82dZ3Ewlq5ZGvwhNZ1zhKLQYaeaBTh8Ucx'+
  'qW6BUdw5jaHVBd6+qWJWQZYdrGwa2A47nyH3mPSM81iHNZN0RFOPlkos51KxZO7b+2R0in0Vb'+
  '7mDX0r3LuFVdpjiyHbaYzztikuQ2b8lDNkQidnJ+8YFzvq7/zsRPDRhckluewhMGR7CTcBkCX'+
  '6ggj7SDco5+/Qz8xI5XKq4UXozw+mky4dFctS73dBdV/Si9Bxsn4NhthzSdpuXaT+82QaWrX/'+
  'F/nPUhQFUY0jV1hzvsWEQIDAQAB';

const UPDATE_JSON = '' +
  '{"branch": "development"\n'+
  ',"changes": "Testing the ruleset update feature"\n'+
  ',"date": "29-07-2014"\n'+
  ',"hash": "b48331bfd0848bf658fe1184578dbd0218cd99a4838de6caddc0624a56b43a"\n'+
  ',"hashfn": "sha256"\n'+
  ',"source": "http://0.0.0.0:8000/data/rulesets.sqlite"\n'+
  ',"version": "4.0.17.1"}\n';

const UPDATE_JSON_SIG = '' +
  'MIIBFDANBgkqhkiG9w0BAQUFAAOCAQEAPKm08M7KF+P0BEeQCWfNv1oVurBpGywzGcdARX46nN'+
  'YjCd7NquqcuinetoBHmAvVa4P4y1aiMx2ZHUn43U/gFFWoyQpxB5OJ/bbT90rMkSmNyDBL4kX5'+
  'QE9UZgU4NHIT3iO2MMtgag9/Ng9Y3+z6U0VjiGMXDQab5I6C0UzMyhkVcBmfNejjQFIKT0Ryqr'+
  'jxjdmhXugpGQuXHheadVQCYxeII4doLJTw+30uxTxoggazQm4gdxwKXPGDNn6PiTdiCwwG53eo'+
  'rAcnisjr/9geRvWTa29lom/M+BY91JNoloshF9XF8IBBZAzVGF2plBzbQ5OMWa08IJCpxc/kzjrlvw==';

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
    'b48331bfd0848bf658fe1184578dbd0218cd99a4838de6caddc0624a56b43a',
    'Test that the data was parsed into JSON properly');
};

exports['test update JSON signature validity'] = function(assert) {
  let hashed = hashSHA256(UPDATE_JSON);
  let verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                   .createInstance(Ci.nsIDataSignatureVerifier);
  assert.equal(hashed,
    '65ebd0e39069cedc1fdfedcc5e791a73381bf03ebb5d8696b5b25d788229f5a4', 
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
