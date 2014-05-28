/* Secure ruleset udpate mechanism
 * The contents of this file exist to provide HTTPS Everywhere with a secure mechanism
 * for updating the extension's database of rulesets.
 * This "module" handles the tasks of fetching an update.json[1] manifest and:
 * 1) determining whether an update to the ruleset library has been released, and
 * 2) verifyies that the update is authentic before applying the new ruleset.
 *
 * [1] The format and specification of the update.json file is detailed within a
 *     Github gist, at https://gist.github.com/redwire/2e1d8377ea58e43edb40
 *
 * The file https-everywhere/utils/ruleset_update_manifest.py exists to automate
 * part of the process of creating the update.json manifest data.
 */

/* ruleset update key
 * This is a hardcoded public key required to verify the signature over the
 * stringified update object within the whole update manifest object.
 */
// TODO
// Set this value.
const RULESET_UPDATE_KEY = '';

/* RulesetUpdate
 * Provides the functionality of obtaining, verifying the authenticity of, and
 * applying updates.
 * updateManifestSource - the URL from which the update.json file is fetched.
 *                        e.g. https://eff.org/files/https-everywhere/update.json
 */
// TODO
// Move class instances into only the functions they are needed in.
// Leave them here for a reference for now.
function RulesetUpdater(updateManifestSource) {
  this.unzip = Cc['@mozilla.org/libjar/zip-reader;1'].createInstance(Ci.nsIZipReader);
  this.manifestSrc = updateManifestSource;
}

/* Prototype functionality notes
 * verifyUpdateSignature 
 *   The hash can be initialized to use MD2, MD5, SHA1, SHA256, SHA384, or SHA512
 */
RulesetUpdater.prototype = {
  log: function(level, msg) {
    https_everywhereLog(level, msg);  
  },
  fetchUpdate: function() {
    var xhr = new XMLHttpRequest();
    xhr.open('get', this.manifestSrc, true);
    xhr.onreadystatechange = function() {
      var status;
      var data;
      if (xhr.readyState === 4) { // complete
        status = xhr.status;
        if (status === 200) { // OK
          data = JSON.parse(xhr.responseText);
          this.conditionallyApplyUpdate(data);
        } else {
          this.log(WARN, 'Could not fetch update manifest at ' + this.manifestSrc);
        }
      }
    };
    xhr.send();
  },
  conditionallyApplyUpdate: function(updateObj) {
    var validSignature = verifyUpdateSignature(
                           JSON.stringify(updateObj.update),
                           convertToACString(updateObj.update_signature));
    if (!validSignature) {
      this.log(WARN, 'Validation of the update signature provided failed');
      return; // DO NOT continue past here
    }
  },
  verifyUpdateSignature: function(updateStr, signature) {
    var checkHash = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    var verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                     .createInstance(Ci.nsIDataSignatureVerifier);
    var data = convertToACString(updateStr);
    checkHash.init(checkHash.SHA1);
    checkHash.update(data, data.length);
    var hash = checkHash.finish(false);
    return verifier.verifyData(hash, signature, convertToACString(RULESET_UPDATE_KEY));
  },
  convertToACString: function(str) {
    var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                      .createInstance(ci.nsIScriptableUnicodeConverter);
    converter.charset = 'UTF-8';
    var result = {}; // An out paramter used by converter.convertToByteArray.
    var data = converter.convertToByteArray(updateStr, result);
    return data;
  }
};
