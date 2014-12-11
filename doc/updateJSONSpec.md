Previous Commentary
===================

This document used to be hosted as a Gist, and there was some commentary on the document
on the relevant gist page.  That commentary can be [found here](https://gist.github.com/redwire/2e1d8377ea58e43edb40).

update.json and update.json.sig
===============================

The file `update.json` provides information about the currently deployed HTTPS Everywhere
ruleset library.  The file contains the same kind of information as is stored in the
`update.rdf` file used to tell the HTTPS Everywhere extension where to fetch and how to
verify updates to the whole extension.

The utility script `https_everywhere/utils/ruleset_update_manifest.py` automates most of
the process of creating `update.json`, and is simply run with the command:

    python utils/ruleset_update_manifest.py

Signing the `update.json` file requires the use of NSS tools and pk1sign, which should
come with the NSS tools. They can be installed on Debian-based Gnu+Linux systems via:

    sudo apt-get install libnss3-tools

A signing key can be created using the following commands:

    # Make the NSS keyring directory
    mkdir nssdb
    # Initialize the directory to be used as a keyring
    certutil -N -d nssdb
    # Generate a 2048-bit self-signed object signing certificate nicknamed "httpse"
    certutil -S -n httpse -g 2048 -d nssdb -t "p,p,u" -s "CN=EFF" -x

Finally, issuing the following command will output both the signature of `update.json`
and the public key used to verify it, both base64 encoded.

    pk1sign -i update.json -k httpse -d nssdb

Fetching
========

Retrieving updates for only a part of an extension is not possible using the builtin
extension update mechanisms supported by Firefox.  However, fetching files using standard
XMLHTTPRequests from within the extension is trivial to accomplish and does not require trying
to force the browser to prematurely check for updates or apply changes only to parts of the
extension.
Thus, a simple XHR will be used to fetch `update.json` from eff.org.

A signature over the raw bytes of `update.json` will be served as `update.json.sig` from a
separate hard-coded URL.

The extension should check for ruleset updates when the browser is started, and then again
every 10800000 milliseconds (3 hours).
If an attempt to fetch or verify an update fails, the extension should request `update.json` 
again every 300000 + R milliseconds, where R is a random number between 0 and 300000.
The extension should attempt this a maximum of 6 times until it is
able to fetch `update.json` and verify the contents before defaulting back to waiting 3 hours.

Every time the extension finds that the data provided by `update.json` to be inauthentic,
either as a result of the hash of the database file not matching or the signature not verifying,
the extension must send a POST request to a hardcoded failure-reporting url containing the data 
in the `update.json` file that it tried and failed to verify.  The format for failure reports
has yet to be determined.

Verification and Version Checking
=================================

In order to compute the hash of the database file, the nsICryptoHash class will be used.
https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsICryptoHash
SHA1 is currently being used as the hashing algorithm.

In order to verify the signature over `update.json` file contents, which is the content of `update.json.sig`,
the nsIDataSignatureVerifier class will be used.
https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIDataSignatureVerifier

The `version` will be compared to the currently installed ruleset library version using nsIVersionComparator.
https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIVersionComparator
Any HTTPS Everywhere extension with version X.Y.Z can ONLY accept ruleset versions of the form X.Y.Z.N, which
is to say that the extension will only accept ruleset versions that are subversions of itself.

The branch field can be checked and referenced against a value stored in user preferences.
A stable release of the extension will have a `branch` preference set to "stable",
and a development release will set the option to "development" or another specified constant.

Updating
========

For an early implementation of the ruleset update mechanism, the extension will update its
ruleset library (stored as a SQLite database) by fetching a SQLite database file from eff.org
containing the new ruleset library, and replace its local database file.
Replacing the local rulesets library will only occur after validating `update.json`
(pseudocode below).

Manifest
========

The following is the format for a simple `update.json` containing information about a single
ruleset library to be used by all target applications.

    {"branch": <ruleset branch>
    ,"changes": <a short description of recent changes>
    ,"date": <the date the new db was released>
    ,"hash": <the hash of the db file>
    ,"hashfn": <The name of the hash function to use>
    ,"source": <the URL serving the updated ruleset db>
    ,"version": <ruleset release version>}

The meanings of each field are explained as follows:

* `branch` is a machine-readable target extension branch, e.g "stable", "developer", "willeatyourpc", etc. The extension SHOULD check that this field matches the extension's branch preference and MAY refuse to accept updates it doesn't like, e.g. stable extension release MAY refuse to update to  developer rulesets.
* `date` is a formatted date string detailing the date that the release to the ruleset was released, and will be set
automatically by the `ruleset_update_manifest.py` utility. The format for the date is "dd-mm-yyyy". For example, "08-06-2014".
* `changes` is a short human-readable description of what has been changed, perhaps a list of the biggest or most requested fixes
* `hash` is a hash of the database file's content, encoded in hex. The hash function to use is specified by `hashfn`.
* `hashfn` is the name of the hash function used to compute the hash of the database file and MUST be one of md5, sha1, sha256, sha384, or sha512.
* `source` is the URL from which the most recently released database file is to be fetched. The URL must address a valid eff.org location and must not be overwritten by the extension.
* `version` is the ruleset release version, which is a subversion of the extension release version and MUST be checked by the updater to determine whether the advertised release is newer than the currently installed ruleset library. A ruleset release with a version number such as "3.5.1.2" must ONLY be accepted by HTTPS-Everywhere version 3.5.1, and so on.

Pseudocode of update procedure
==============================

The following is a high-level description of how the update mechanism is expected to function.  Specifically, it details the order in which important authenticity tests are carried out 

    // Called at startup of HTTPS-E and every three hours afterwards.
    function checkAndApplyUpdate() do
        updateURL := preferences.get("updateURL")
        updateSigURL := preferences.get("updateSigURL")
        branchName := preferences.get("branchName")
        currentVersion := preferences.get("rulesetVersion")
        # tryFetch tries to request data up to 6 times in randomly padded intervals
        # See the "Fetching" section
        updateJSON := tryFetch(updateURL)
        updateData := JSON.parse(upateJSON)
        shouldUpdate := updateJSON != null and\ # Were able to receive data
                        updateData.version > currentVersion and\
                        isSubversion(updateData.version, EXTENSION_VERSION) and\
                        branchName == updateData.branch
        inauthentic := true
        if shouldUpdate then
            signature := tryFetch(updateSigURL)
            if isValidSignature(signature, updateJSON, PUBLIC_SIGNING_KEY) then
                databaseSource := tryFetch(updateData.source)
                if databaseSource == null then
                    return
                endif
                dbHash := hashFunctions[updateData.hashfn](databaseSource)
                if dbHash == updateData.hash then
                    dbFile := openFile(RULESET_DB_FILE)
                    write(databaseSource, dbFile)
                    HTTPSRules.init()
                    inauthentic := false
                endif
            endif
        endif
        if inauthentic then
            # tryPost works like tryFetch, but also sends data with a POST request
            tryPost(REPORT_INAUTHENTIC_UPDATE_URL, updateData)
        endif
    endfunction

