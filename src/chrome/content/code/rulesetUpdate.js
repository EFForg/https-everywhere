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

// TODO
// Set this value.
/* Hardcoded public key used to verify the signature over the update data */
const RULESET_UPDATE_KEY = '';

/* extension release branch preference key */
const BRANCH_PREF= 'extensions.https_everywhere.branch_name';

/* extension release version preference key */
const VERSION_PREF = 'extensions.https_everywhere.release_version';

/* installed ruleset version preference key */
const RULESET_VERSION_PREF = 'extesnsions.https_everywhere.ruleset_version';

/* path to the ruleset library database file */
const RULESET_DBFILE_PATH = 'chrome://https-everywhere/content/rulesets.sqlite';

/* maximum number of attempts to fetch ruleset updates */
const MAX_RSUPDATE_FETCHES = 6;

/* name of the hash function to use to compute the digest of update.json content */
const SIGNING_DIGEST_FN = 'sha256';

/* RulesetUpdate
 * Provides the functionality of obtaining, verifying the authenticity of, and
 * applying updates.
 * updateManifestSource - the URL from which the update.json file is fetched.
 *                        e.g. https://eff.org/files/https-everywhere/update.json
 * updateSigSource      - the URL from which update.json.sig is fetched.
 */
function RulesetUpdater(updateManifestSource, updateSigSource) {
  this.manifestSrc = updateManifestSource;
  this.sigFileSrc = updateSigSource;
  this.HTTPSEverywhere = Cc['@eff.org/https-everywhere;1']
                         .getService(Ci.nsISupports)
                         .wrappedJSObject;
}

RulesetUpdater.prototype = {
  log: function(level, msg) {
    https_everywhereLog(level, msg);  
  },

 /* Initiates the check for updates and tests of authenticity.
  * Must be wrapped in a function to call from setInterval, i.e.:
  * setInterval(function() { updater.fetchUpdate(); }, interval);
  */
  fetchUpdate: function() {
    this.HTTPSEverywhere.try_fetch(MAX_RSUPDATE_FETCHES, 'GET', this.manifestSrc,
      function(responseText) {
        this.conditionallyApplyUpdate(responseText);
      }
    );
  },

 /* Verifies the signature on the updateObj.update and then issues a request that
  * will fetch and test the hash on the newly released ruleset database file.
  * updateObj - The JSON manifest of the update information for the ruleset update.
  */
  conditionallyApplyUpdate: function(update) {
    var updateObj = JSON.parse(update);
    var extVersion = HTTPSEverywhere.instance.prefs.getCharPref(VERSION_PREF);
    var extBranch = HTTPSEverywhere.instance.prefs.getCharPref(BRANCH_PREF);
    var rulesetVersion = HTTPSEverywhere.instance.prefs.getCharPref(RULESET_VERSION_PREF);
    if (!this.checkVersionRequirements(extVersion,  rulesetVersion, updateObj.version)) {
      this.log(NOTE, 'Downloaded an either incompatible ruleset library or not a new one.');
      return; 
    }
    if (updateObj.branch !== extBranch) {
      this.log(WARN, 'Downloaded a ruleset update for the incorrect branch.');
      return;
    }
    this.HTTPSEverywhere.try_fetch(MAX_RSUPDATE_FETCHES, 'GET', this.sigFileSrc,
      function(signature) {
        var updateHash = computeHash(update, SIGNING_DIGEST_FN);
        if (this.verifyUpdateSignature(updateHash, signature)) {
          this.fetchRulesetDBFile(updateObj.source, updateObj.hashfn, updateObj.hash);
        } else {
          this.log(WARN, 'Validation of the update signature provided failed.');
          // TODO
          // Ping the verification-failure-reporting URL
        }
      }
    );
  },

 /* Attempts to verify the provided signature over updateStr using
  * the hardcoded RULESET_UPDATE_KEY public key.
  */
  verifyUpdateSignature: function(updateStr, signature) {
    var verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                     .createInstance(Ci.nsIDataSignatureVerifier);
    return verifier.verifyData(updateStr, signature, RULESET_UPDATE_KEY);
  },

 /* Checks that the ruleset version to download is greater than the current ruleset library
  * version (rsVersion) and is a subversion of the extension version (extVersion).
  */
  checkVersionRequirements: function(extVersion, rsVersion, newVersion) {
    var verCompare = Cc['@mozilla.org/xpcom/version-comparator;1']
                       .getService(Ci.nsIVersionComparator);
    var newRulesetExtVer = newVersion.slice(0, newVersion.lastIndexOf('.'));
    return verCompare.compare(extVersion, newRulesetExtVer) === 0\
        && verCompare.compare(newVersion, rsVersion) > 0;
  },

 /* Issues a request to download a new, zipped ruleset database file and then determines whether
  * its hash matches the one provided in the verified update manifest before applying the changes.
  * url  - The full URL to fetch the file from, MUST be using HTTPS!
  * hash - The hash of the database file provided by the update manifest verified previously.
  */
  fetchRulesetDBFile: function(url, hashfn, hash) {
    this.HTTPSEverywhere.try_fetch(MAX_RSUPDATE, 'GET', url,
      function(dbfileContent) {
        var dbHash = computeHash(dbFileContent, hashfn);
        if (dbHash === hash) {
          this.applyNewRuleset(dbfileContent);
        } else {
          this.log(WARN, hashfn + ' hash of downloaded ruleset library did not match provided hash.');
          // TODO
          // Ping URL for verification-failure-reporting
        }
      }
    );
  },


 /* Compute the hash using a function specified by hashfn of data and encode as hex */
  computeHash: function(data, hashfn) {
    var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                      .createInstance(ci.nsIScriptableUnicodeConverter);
    var hashing = Cc['@mozilla.org/security/hash;1']
                    .createInstance(Ci.nsICryptoHash);
    function toHexString(charCode) {
      return ('0' + charCode.toString(16)).slice(-2);
    }
    converter.charset = 'UTF-8';
    var result = {};
    var converted = converter.convertToByteArray(data, result);
    if      (hashfn === 'md5')    hashing.init(hashing.MD5);
    else if (hashfn === 'sha1')   hashing.init(hashing.SHA1);
    else if (hashfn === 'sha256') hashing.init(hashing.SHA256);
    else if (hashfn === 'sha384') hashing.init(hashing.SHA384);
    else if (hashfn === 'sha512') hashing.init(hashing.SHA512);
    else return null; // It's a better idea to fail than do the wrong thing here.
    hashing.update(converted, converted.length);
    var hash = hashing.finish(false);
    return [toHexString(hash.charCodeAt(i)) for (i in hash)].join('');
  },

 /* Applies the new ruleset database file by replacing the old one and reinitializing 
  * the mapping of targets to applicable rules.
  */
  applyNewRuleset: function(dbsource) {
    var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    var path = this.HTTPSEverywhere.rw.chromeToPath(RULESET_DBFILE_PATH);
    file.initWithPath(path);
    this.HTTPSEverywhere.rw.write(file, dbsource);
    HTTPSRules.init();
  }
};
