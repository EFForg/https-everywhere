// Test the signature verification of the sha256 hash of update.json

const { Cc, Ci } = require('chrome');

// URLs of gist raws containing some example data
const UPDATE_JSON = 'https://gist.githubusercontent.com/redwire/c9b668ae3360e0d91691/raw/eb7e5897b51be660991c80dc0fca3bf93da823e0/example_update_json';
const UPDATE_JSON_SIG = 'https://gist.githubusercontent.com/redwire/f0d28c982fff5387568b/raw/be62109572d2a9416901f882984aceb76dae8f62/example_update_json_sig';

const PUBKEY = [
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwNFv2HXZ5YdXa18irhRR',
  'rzGGQERbzEKGhE/5NHY5go75dpt0eIe3AMhRNkeDaF3fiV6yABAjre6EZlxRvzzx',
  'W9iSdSqkbHk7nvqQMnWLQCKW0e5VlVCGdIZ71kJREEFjaeuyWIQef7gEsoFRd0Xd',
  '6L1LLCAamJ2cf+Qx4ARGyUwsfQGWpmt/qTV1Ts7t3VDD7kOMBkI6rRzEvNblgpJ3',
  '9BDbQap6Dua1kFxdrY77Pkarh+ziaOQ3TWbO3qFOy9RpKZ4TusJp1qlOymmiclpC',
  'tMeTAbZr4aYzUJ/fqe4RPWReWji4fwdsHR6zXWCTbTunCUMluMe7zyCa84TzZv/o',
  'ywIDAQAB'
].join('');

function makeRequest(method, url, onResponse) {
  let xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
              .createInstance(Ci.nsIXMLHttpRequest);
  xhr.open(method, url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) { // Complete
      onResponse(xhr);
    }
  };
}

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
  makeRequest('GET', UPDATE_JSON, function(xhr) {
    assert.strictEqual(xhr.status, 200, 'Test that update.json data was received');
    assert.strictEqual(xhr.responseText.length, 272, // update.json contains 272 bytes
      'Test that the right amount of data was received.');
    let updateObj = JSON.parse(xhr.responseText);
    assert.equal(updateObj.hash, 
      'df1453c7116d3ebef93ab5ea79d693fdf0ea4eacc01cfa687418fa23319c36b',
      'Test that the data was parsed into JSON properly');
  });
};

exports['test update JSON signature validity'] = function(assert) {
  makeRequest('GET', UPDATE_JSON, function(xhr1) {
    if (xhr1.status === 200) {
      makeRequest('GET', UPDATE_JSON_SIG, function(xhr2) {
        assert.strictEqual(xhr2.status, 200,
          'Test that the update.json.sig data was received');
        assert.strictEqual(xhr2.responseText.length, 349, 
          'Test that the right amount of data was received');
        let hashed = hashSHA256(xhr1.responseText);
        assert.equal(hashed,
          'df1453c7116d3ebef93ab5ea79d693fdf0ea4eacc01cfa687418fa23319c36b',
          'Test that the update.json data hashed to the right value.');
        assert.ok(validUpdateData(hashed, xhr2.responseText),
          'Test that the update.json raw data is authentic');
      });
    }
  });
};

require('sdk/test').run(exports);
