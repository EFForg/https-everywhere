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

/* release date preference key
 * This is the key used to set and obtain the date value of the most recently
 * downloaded ruleset release as a preference.
 */
const UPDATE_PREF_DATE = 'extensions.https_everywhere.rulesets_last_updated';

/* extension release type preference
 * This is the key to the preference that states the release type of the client,
 * such as "development" or "stable" for dev and stable releases respectively.
 */
const RELEASE_TYPE_PREF = 'extensions.https_everywhere.release_type';

/* database file paths
 * The path to the temporary file used to store the contents of the downloaded
 * ruleset database zipfile and the extracted sqlite file, as well as the
 * location of the sqlite database file used by the extension to load rules.
 */
const TMP_DBZIP_PATH = 'chrome://https-everywhere/content/rulesetdb.zip';
const TMP_DBFILE_PATH = 'chrome://https-everywhere/content/tmprulesetdb.sqlite';
const RULESET_DBFILE_PATH = 'chrome://https-everywhere/content/rulesets.sqlite';

/* RulesetUpdate
 * Provides the functionality of obtaining, verifying the authenticity of, and
 * applying updates.
 * updateManifestSource - the URL from which the update.json file is fetched.
 *                        e.g. https://eff.org/files/https-everywhere/update.json
 */
function RulesetUpdater(updateManifestSource) {
  this.manifestSrc = updateManifestSource;
  this.HTTPSEverywhere = Cc['@eff.org/https-everywhere;1'].getService(Ci.nsISupports).wrappedJSObject;
}

RulesetUpdater.prototype = {
  log: function(level, msg) {
    https_everywhereLog(level, msg);  
  },

  /* Should be periodically called to check for a new update to the extension's ruleset library.
   */
  fetchUpdate: function() {
    var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
    xhr.open('GET', this.manifestSrc, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) { // complete
        if (xhr.status === 200) { // OK
          var data = JSON.parse(xhr.responseText);
          this.conditionallyApplyUpdate(data);
        } else {
          this.log(WARN, 'Could not fetch update manifest at ' + this.manifestSrc);
        }
      }
    };
    xhr.send();
  },

  /* Verifies the signature on the updateObj.update and then issues a request that
   * will fetch and test the hash on the newly released ruleset database file.
   * updateObj - The JSON manifest of the update information for the ruleset update.
   */
  conditionallyApplyUpdate: function(updateObj) {
    var validSignature = this.verifyUpdateSignature(
                           JSON.stringify(updateObj.update),
                           updateObj.update_signature);
    if (!validSignature) {
      this.log(WARN, 'Validation of the update signature provided failed');
      return; // Not an authentic release!
    }
    var newVersion = parseFloat(updateObj.update.date);
    if (isNaN(newVersion)) {
      this.log(WARN, 'date field in update JSON (' + updateObj.update.date + ') not valid format');
      return; // Cannot determine whether update is new with invalid date field.
    }
    // TODO
    // Make sure this is the right way to access preferences even with
    // this.HTTPSEverywhere existing.
    // Preferencs can only be stored as ints, strings, and bools, parse float from a string.
    var currentVersion = parseFloat(HTTPSEverywhere.instance.prefs.getCharPref(UPDATE_PREF_DATE));
    var releaseType = HTTPSEverywhere.instance.prefs.getCharPref(RELEASE_TYPE_PREF);
    if (!isNaN(currentVersion) && newVersion <= currentVersion) {
      return; // No new version to download.
    }
    if (updateObj.update.branch !== releaseType) {
      return; // Incorrect release type.
    }
    this.fetchRulesetDBFile(updateObj.update.source, updateObj.update.hash);
    // Even if the hashes of the database file contents and the one provided don't match,
    // the ruleset update preference should be updated so that this faulty release is
    // not downloaded again.
    // TODO
    // Ask about this.
    HTTPSEverywhere.instance.prefs.setFloatPref(UPDATE_PREF_DATE, newVersion);
  },

 /* Tests using the hardcoded RULESET_UPDATE_KEY that the signature of the update object
  * validates and that the update is thus authentic.
  * The hash can be initialized to use MD2, MD5, SHA1, SHA256, SHA384, or SHA512
  * updateStr - The stringified update object from the update manifest.
  * signature - The signature over the update object provided by the update manifest.
  */
  verifyUpdateSignature: function(updateStr, signature) {
    var checkHash = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    var verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                     .createInstance(Ci.nsIDataSignatureVerifier);
    var data = this.convertString(updateStr, 'UTF-8');
    checkHash.init(checkHash.SHA1);
    checkHash.update(data, data.length);
    var hash = checkHash.finish(false);
    return verifier.verifyData(hash, signature, RULESET_UPDATE_KEY);
  },

 /* Convert a regular string into a ByteArray with a given encoding (such as UTF-8).
  * str      - The standard javascript string to convert.
  * encoding - The encoding to use as a string, such as 'UTF-8'.
  */
  convertString: function(str, encoding) {
    var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                      .createInstance(ci.nsIScriptableUnicodeConverter);
    converter.charset = encoding;
    var result = {}; // An out paramter used by converter.convertToByteArray.
    var data = converter.convertToByteArray(updateStr, result);
    return data;
  },

 /* Issues a request to download a new, zipped ruleset database file and then determines whether
  * its hash matches the one provided in the verified update manifest before applying the changes.
  * url  - The full URL to fetch the file from, MUST be using HTTPS!
  * hash - The hash of the database file provided by the update manifest verified previously.
  */
  fetchRulesetDBFile: function(url, hash) {
    var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) { // complete
        if (xhr.status === 200) { // OK
          this.storeDBFileZip(xhr.responseText);
          this.extractTmpDBFile();
          var newHash = this.computeTmpDBFileHash();
          if (newHash === hash) {
            this.applyNewRuleset();
          }
        }
      }
    };
    xhr.send();
  },

 /* Stores the zipped database file contents to a local file to be extracted from.
  * zipSource - The raw zip file contents to store in TMP_DBZIP_PATH (see const def).
  */
  storeDBFileZip: function(zipSource) {
    var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    var path = this.HTTPSEverywhere.rw.chromeToPath(TMP_DBZIP_PATH);
    file.initWithPath(path);
    this.HTTPSEverywhere.rw.write(file, zipSource);
  },

 /* Extracts the zipped database file stored at TMP_DBZIP_PATH into TMP_DBFILE_PATH.
  */
  extractTmpDBFile: function() {
    var zipr = Cc['@mozilla.org/libjar/zip-reader;1'].createInstance(Ci.nsIZipReader);
    var infile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    var outfile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    var inPath = this.HTTPSEverywhere.rw.chromeToPath(TMP_DBZIP_PATH);
    var outPath = this.HTTPSEverywhere.rw.chromeToPath(TMP_DBFILE_PATH);
    infile.initWithPath(inPath);
    outfile.initWithPath(outPath);
    zipr.open(infile);
    zipr.extract(outPath, outfile);
    zipr.close();
  },

 /* Computes the hash of the database file stored at TMP_DBFILE_PATH.
  */
  computeTmpDBFileHash: function() {
    var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    var hash = Cc['@mozilla.org/security/hash;1'].createInstance(Ci.nsICryptoHash);
    var path = this.HTTPSEverywhere.rw.chromeToPath(TMP_DBFILE_PATH);
    hash.init(hash.SHA1);
    file.initWithPath(path);
    var content = this.convertString(this.HTTPSEverywhere.rw.read(file), 'UTF-8');
    hash.update(content, content.length);
    var dbfHash = hash.finish(false);
    return dbfHash;
  },

 /* Applies the new ruleset database file by replacing the old one and reinitializing 
  * the mapping of targets to applicable rules.
  */
  applyNewRuleset: function() {
    var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    var path = this.HTTPSEverywhere.rw.chromeToPath(TMP_DBFILE_PATH);
    var dbfileParts = RULESET_DBFILE_PATH.split('/');
    var dbFileName = dbfileParts[dbfileParts.length - 1];
    file.initWithPath(path);
    file.renameTo(null, dbFileName);
    HTTPSRules.init();
  }
};
