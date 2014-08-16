/* Secure ruleset udpate mechanism
 * The contents of this file exist to provide HTTPS Everywhere with a secure mechanism
 * for updating the extension's database of rulesets.
 * This "module" handles the tasks of fetching an update.json[1] manifest and:
 * 1) determining whether an update to the ruleset library has been released, and
 * 2) verifies that the update is authentic before applying the new ruleset.
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

/* installed ruleset version preference key */
const RULESET_VERSION_PREF = 'extensions.https_everywhere.ruleset_version';

/* key for the preference that holds the url to fetch update.json and update.json.sig from */
const RSUPDATE_URL_PREF = 'extensions.https_everywhere.ruleset_update_url';
const RSUPDATE_SIG_URL_PREF = 'extensions.https_everywhere.ruleset_update_signature_url';

/* path to the temporary download location of new ruleset database files */
const TMP_RULESET_DBFILE_PATH = OS.Path.join(
  OS.Constants.Path.tmpDir,
  nonceForTmpFile(32) + "new_rulesets.sqlite");

/* maximum number of attempts to fetch ruleset updates */
const MAX_RSUPDATE_FETCHES = 6;

const _prefs = CC["@mozilla.org/preferences-service;1"]
                 .getService(CI.nsIPrefService).getBranch("");

function nonceForTmpFile(numBytes) {
  var rng = Cc['@mozilla.org/security/random-generator;1']
              .createInstance(Ci.nsIRandomGenerator);
  var buffer = new Array(numBytes);
  rng.generateRandomBytes(numBytes, buffer);
  var s = [("0" + b.toString(16)).slice(-2) for each (b in bytes)].join("");
  return s;
}

/*******************************************************************************
 *** Design Explanation                                                        *
 * HTTPSEverywhere cannot be referred to within the constructor of a more      *
 * typical object definition, because doing so would create a circular         *
 * dependency between HTTPSEverywhere's and RulesetUpdater's constructors.     *
 * Using an anonymous function, I create a new scope within which helper       *
 * functions can be defined and invoked in a natural order.                    *
 *******************************************************************************
 */

const RulesetUpdater = {     // BEGIN OBJECT DEFINITION
fetch_update : (function() { // BEGIN MODULE

/* Initiates the check for ruleset updates.
 */
function fetchUpdate() {
  https_everywhereLog(INFO, "Calling fetchUpdate");
  var manifestSrc = _prefs.getCharPref(RSUPDATE_URL_PREF);
  HTTPSEverywhere.instance.try_request(MAX_RSUPDATE_FETCHES, 'GET', manifestSrc,
    function(responseText) {
      https_everywhereLog(INFO, "Successfully fetched update.json file data");
      conditionallyApplyUpdate(responseText);
    });
}

/* Get the branch name of the installed extension.
 * Assumes that, if "development" is in the version string, the branch is "development",
 * otherwise, that it is "stable".
 *
 * @param version - The version string of the extension.
 * @return string - The branch name of the extension ("development" or "stable").
 */
function extensionBranchName(version) {
  if (version.indexOf("development") >= 0) {
    return "development";
  }
  return "stable";
}

/* Ensures that the ruleset update described by the downloaded update.json file is
 * appropriate for this version of the extension and is new, verifies update.json's
 * authenticity, and fetches the database file containing the updated rulesets.
 *
 * @param update - The string contents of the update.json file.
 */
function conditionallyApplyUpdate(update) {
  https_everywhereLog(INFO, "Got update data:");
  https_everywhereLog(INFO, update);
  var updateObj = JSON.parse(update);
  AddonManager.getAddonByID("https-everywhere@eff.org", function (addon) {
    var extVersion = addon.version;
    var extBranch = extensionBranchName(extVersion);
    var rulesetVersion = _prefs.getCharPref(RULESET_VERSION_PREF);
    https_everywhereLog(INFO, "Inside call to conditionallyApplyUpdate");
    if (!checkVersionRequirements(extVersion,  rulesetVersion, updateObj.version)) {
      https_everywhereLog(NOTE, 'Downloaded an either incompatible ruleset library or not a new one.');
      return; 
    }
    if (updateObj.branch !== extBranch) {
      https_everywhereLog(NOTE, 'Downloaded a ruleset update for the incorrect branch.');
      return;
    }
    var sigFileSrc = _prefs.getCharPref(RSUPDATE_SIG_URL_PREF);
    HTTPSEverywhere.instance.try_request(MAX_RSUPDATE_FETCHES, 'GET', sigFileSrc, function(signature) {
      signature = signature.trim();
      https_everywhereLog(INFO, "Successfully fetched update.json.sig file data");
      if (verifyUpdateSignature(update, signature)) {
        https_everywhereLog(INFO, "Ruleset update data signature verified successfully");
        fetchVerifyAndApplyDBFile(updateObj.source, updateObj.version, updateObj.hashfn, updateObj.hash);
      } else {
        https_everywhereLog(WARN, 'Validation of the update signature provided failed.');
        // TODO
        // Ping the verification-failure-reporting URL
      }
    });
  });
}

/* Attempts to verify the provided signature over updateStr using
 * the hardcoded RULESET_UPDATE_KEY public key.
 *
 * @param updateStr - The string contents of the downloaded update.json file.
 * @param signature - The string contents of update.json.sig.
 * @return bool     - true if the update.json content is authentic else false.
 */
function verifyUpdateSignature(updateStr, signature) {
  var verifier = Cc['@mozilla.org/security/datasignatureverifier;1']
                   .createInstance(Ci.nsIDataSignatureVerifier);
  https_everywhereLog(INFO, "Created instance of nsIDAtaSignatureVerifier");
  return verifier.verifyData(updateStr, signature, RULESET_UPDATE_KEY);
}


/* Checks that the ruleset version to download is greater than the current ruleset library
 * version  and is a subversion of the extension version.
 *
 * @param extVersion - The version of the extension (eg: "5.0.0")
 * @param rsVersion  - The current ruleset version (eg: "5.0.0.1")
 * @param newVersion - The version of the new ruleset supplied by update.json.
 * @return bool      - true if the new ruleset version is applicable else false.
 */
function checkVersionRequirements(extVersion, rsVersion, newVersion) {
  var verCompare = Cc['@mozilla.org/xpcom/version-comparator;1']
                     .getService(Ci.nsIVersionComparator);
  https_everywhereLog(INFO, "Checking version requirements with extension version " + extVersion +
                            " and ruleset version " + rsVersion);
  var newRulesetExtVer = newVersion.slice(0, newVersion.lastIndexOf('.'));
  var sameExtVer = verCompare.compare(extVersion, newRulesetExtVer) === 0;
  var newRSVer = verCompare.compare(newVersion, rsVersion) > 0;
  return sameExtVer && newRSVer;
}

/* Compute the hash of the contents of a binary file's contents.
 *
 * @param path    - The string path to the file whose contents are to be hashed.
 * @param length  - The number of bytes of data in the file to hash.
 * @param hashfn  - The name of the hash function to use (eg: "sha256").
 * @return string - The hex-encoded hash of the file's contents.
 */
function hashBinaryFile(path, length, hashfn) {
  var READONLY = 0x01;
  var READ_PERMISSIONS = 0444;
  var NOFLAGS = 0;
  var f = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  var istream = Cc['@mozilla.org/network/file-input-stream;1']
                  .createInstance(Ci.nsIFileInputStream);
  var binaryIn = Cc['@mozilla.org/binaryinputstream;1'].createInstance(Ci.nsIBinaryInputStream);
  var hashing = Cc['@mozilla.org/security/hash;1'].createInstance(Ci.nsICryptoHash);
  switch (hashfn) {
    case 'md5':    hashing.init(hashing.MD5);    break;
    case 'sha1':   hashing.init(hashing.SHA1);   break;
    case 'sha256': hashing.init(hashing.SHA256); break;
    case 'sha384': hashing.init(hashing.SHA384); break;
    case 'sha512': hashing.init(hashing.SHA512); break;
    default: return '';
  }
  f.initWithPath(path);
  istream.init(f, READONLY, READ_PERMISSIONS, NOFLAGS);
  binaryIn.setInputStream(istream);
  hashing.updateFromStream(binaryIn, length);
  var hash = hashing.finish(false); // Get binary data back
  istream.close();
  function toHexStr(charCode) {
    return ('0' + charCode.toString(16)).slice(-2);
  }
  return [toHexStr(hash.charCodeAt(i)) for (i in hash)].join('');
}

/* Fetches the contents of the new ruleset database file, ensures that the contents' hash
 * matches what update.json says it should be, and then makes the call to apply the new
 * rulesets database.
 *
 * @param url     - The URL from which to fetch the new rulesets database file.
 * @param version - The ruleset version (eg: 5.0.0.1).
 * @param hashfn  - The name of the hash function to use when hashingthe database file.
 * @param hash    - The hash provided by update.json.
 */
function fetchVerifyAndApplyDBFile(url, version, hashfn, hash) {
  var DEFAULT_PERMISSIONS = -1;
  var NOFLAGS = 0;
  (function recur(max_times) {
    https_everywhereLog(INFO, "Making request to get database file at " + url);
    var xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
    xhr.open("GET", url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function(evt) {
      var arrayBuffer = xhr.response;
      if (arrayBuffer) {
        var byteArray = new Uint8Array(arrayBuffer);
        https_everywhereLog(INFO, "byteArray has length " + byteArray.length);
        var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
        var outstream = Cc['@mozilla.org/network/file-output-stream;1']
                          .createInstance(Ci.nsIFileOutputStream);
        var binout = Cc['@mozilla.org/binaryoutputstream;1'].createInstance(Ci.nsIBinaryOutputStream);
        file.initWithPath(TMP_RULESET_DBFILE_PATH);
        outstream.init(file, DEFAULT_PERMISSIONS, DEFAULT_PERMISSIONS, NOFLAGS);
        binout.setOutputStream(outstream);
        binout.writeByteArray(byteArray, byteArray.length);
        outstream.close();
        var dbHash = hashBinaryFile(TMP_RULESET_DBFILE_PATH, byteArray.length, hashfn);
        https_everywhereLog(INFO, "dbhash = " + dbHash);
        if (dbHash === hash) {
          https_everywhereLog(INFO, 
            'Hash of database file downloaded matches the hash provided by update.json');
          applyNewRuleset(version);
        } else {
          https_everywhereLog(INFO, 'Hash of database file did not match the one in update.json');
          if (max_times > 0) { // Strict limit test
            recur(max_times - 1);
          }
          // TODO: Ping EFF URL to report authenticity verification failure
        }
      } else {
        https_everywhereLog(INFO, 'Did not download any database data');
        if (max_times > 0) { // Strict limit test
          recur(max_times - 1);
        }
        // TODO: Ping EFF URL to report download failure
      }
    };
    xhr.send(null);
  })(MAX_RSUPDATE_FETCHES);
}

/* Moves the downloaded rulesets database into a permanent location and reinitializes
 * HTTPSRules to use the rulesets.
 *
 * @param version - The ruleset version.
 */
function applyNewRuleset(version) {
  var DIRECTORY_TYPE = 1;
  var DIRECTORY_PERMISSIONS = 0777;
  https_everywhereLog(INFO, 'In applyNewRuleset');
  var updatedPath = HTTPSEverywhere.instance.UPDATED_RULESET_DBFILE_PATH();
  var permFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  var tempFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  permFile.initWithPath(updatedPath);
  tempFile.initWithPath(TMP_RULESET_DBFILE_PATH);
  https_everywhereLog(INFO, 'Initialized local database files');
  var permParent = permFile.parent;
  if (permFile.exists()) {
    permFile.remove(false);
    https_everywhereLog(INFO, 'Removed existing updated database file');
  } else if (!permParent.exists()) {
    permParent.create(DIRECTORY_TYPE, DIRECTORY_PERMISSIONS);
    https_everywhereLog(INFO, 'Created directory for downloaded ruleset database files');
  }
  tempFile.moveTo(
    permParent, 
    OS.Path.basename(updatedPath));
  https_everywhereLog(INFO, 'Copied new database file to permanent location');
  HTTPSRules.init();
  _prefs.setCharPref(RULESET_VERSION_PREF, version);
  https_everywhereLog(INFO, 'Reinitialized HTTPSRules with new database');
}

// Export only fetchUpdate
return fetchUpdate;

})() // END MODULE
};   // END OBJECT DEFINITION
