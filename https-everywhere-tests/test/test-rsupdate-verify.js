// Test the signature verification of the sha256 hash of update.json

const { Cc, Ci } = require('chrome');

const PUBKEY = [
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwNFv2HXZ5YdXa18irhRR',
  'rzGGQERbzEKGhE/5NHY5go75dpt0eIe3AMhRNkeDaF3fiV6yABAjre6EZlxRvzzx',
  'W9iSdSqkbHk7nvqQMnWLQCKW0e5VlVCGdIZ71kJREEFjaeuyWIQef7gEsoFRd0Xd',
  '6L1LLCAamJ2cf+Qx4ARGyUwsfQGWpmt/qTV1Ts7t3VDD7kOMBkI6rRzEvNblgpJ3',
  '9BDbQap6Dua1kFxdrY77Pkarh+ziaOQ3TWbO3qFOy9RpKZ4TusJp1qlOymmiclpC',
  'tMeTAbZr4aYzUJ/fqe4RPWReWji4fwdsHR6zXWCTbTunCUMluMe7zyCa84TzZv/o',
  'ywIDAQAB'
].join('');

const UPDATE_JSON = [
  '{"branch": "stable"',
  ',"changes": "Testing signature verification"',
  ',"date": "30-06-2014"',
  ',"hash": "df1453c7116d3ebef93ab5ea79d693fdf0ea4eacc01cfa687418fa23319c36b"',
  ',"hashfn": "sha256"',
  ',"source": "https://eff.org/files/https-everywhere/database.sqlite"',
  ',"version": "3.5.3.1"}'
].join('\n');

const UPDATE_JSON_SIG = [
  'qe6iRKKmxpd9pgFL46QBQXgLi9u/cE0EQ1eBXcBDZaOkbvHqdjvy0Z7YyxnQbKFb',
  'XLi1MBLraMUsBSMnEqduoi1bbaCrFa+Z0lIW9mXl04/LWTjbQFpfC5svtmGghF9b',
  'xP+hExtC3281GniKjk7XGC4G26bAF3feIIzg+4G26XOEJYvVgjfRBfD7q4MAHh5/',
  '58kd2Xz9GERK39xxu4LGW30Q/StOtuNX2MSLPebyY4Grsv96kB/dZKTvMKahhJbr',
  'Iubt2OcyBVq4SLHlm85bx7B86id3KfUVtrnqjHFOD6Hk+zqpB6sft4q4sTjgoCiP',
  '2M4CSUM9vYijpUYNu5NBOg=='
].join('');

function hashSHA256(data) {
  let converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                    .createInstance(Ci.nsIScriptableUnicodeConverter);
  let hashing = Cc['@mozilla.org/security/hash;1']
                  .createInstance(Ci.nsICryptoHash);
  function toHexString(string) {
    return ('0' + charCode.toString(16)).slice(-2);
  }
  hashing.init(hashing.SHA256);
  converter.encoding = 'UTF-8';
  let result = {};
  let converted = converter.convertToByteArray(data, result);
  hashing.update(converted, converted.length);
  var hashed = hashing.finish(false);
  return [toHexString(hashed.charCodeAt(i)) for (i in hashed)].join('');
}

function validUpdateData(updateHash, signature) {
  let verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                   .createInstance(Ci.nsIDataSignatureVerifier);
  return verifier.verifyData(updateHash, signature, PUBKEY);
}

exports['test update JSON parsing'] = function(assert) {
  let updateObj = JSON.parse(UPDATE_JSON);
  // This test is just meant to make sure that the object was parsed into JSON
  // properly and that the attributes of the object created can be read.
  assert.equal(updateObj.hash, 
    'df1453c7116d3ebef93ab5ea79d693fdf0ea4eacc01cfa687418fa23319c36b',
    'Test that the data was parsed into JSON properly');
};

exports['test update JSON signature validity'] = function(assert) {
  let hashed = hashSHA256(UPDATE_JSON);
  assert.equal(hashed,
    'df1453c7116d3ebef93ab5ea79d693fdf0ea4eacc01cfa687418fa23319c36b',
    'Test that the update.json data hashed to the right value.');
  assert.ok(validUpdateData(hashed, UPDATE_JSON_SIG),
    'Test that the update.json raw data is authentic');
};

require('sdk/test').run(exports);
