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
        if (this.verifyUpdateSignature(update, signature)) {
          this.fetchRulesetDBFile(updateObj.source, updateObj.hashfn, updateObj.hash);
        } else {
          this.log(WARN, 'Validation of the update signature provided failed.');
          // TODO
          // Ping the verification-failure-reporting URL
        }
      }
    );
    HTTPSEverywhere.instance.prefs.setFloatPref(RULESET_VERSION_PREF, updateObj.version);
  },

 /* Attempts to verify the provided signature over updateStr using
  * the hardcoded RULESET_UPDATE_KEY public key.
  */
  verifyUpdateSignature: function(updateStr, signature) {
    var verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                     .createInstance(Ci.nsIDataSignatureVerifier);
    return verifier.verifyData(updateStr, signature, RULESET_UPDATE_KEY);
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

      }
    );
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

/* Produces a closure that can initiate a check for an update to the extension's ruleset library.
 * Checking for updates using setInterval(updater.fetchUpdate, X) would not work as
 * the function object would not contain a reference to the correct `this` parameter.
 * Using this, checking for updates is done by calling:
 *   setInterval(checkRulesetUpdates(updater), timeout);
 * updater - An initialized RulesetUpdater (stores the URL to fetch the update manifest from).
 */
function checkRulesetUpdates(updater) {
  return function() {
    updater.fetchUpdate();
  };
}
