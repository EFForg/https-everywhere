/* vim: set expandtab tabstop=2 shiftwidth=2 softtabstop=2 foldmethod=marker: */

/**
 * HTTPS Everywhere Firefox Extension: https://www.eff.org/https-everywhere/
 *
 * Licensed under the GPL v3+.
 * 
 * @copyright Copyright (C) 2010-2013 Mike Perry <mikeperry@fscked.org> 
 *                                    Peter Eckersley <pde@eff.org>
 *                                    and many others.
 */

// Define https everywhere variable object that will act as a namespace, so that 
// global namespace pollution is avoided, although technically not required for
// windows created by add-on.
// See: https://developer.mozilla.org/en-US/docs/Security_best_practices_in_extensions#Code_wrapping
if (!httpsEverywhere) { var httpsEverywhere = {}; }

/**
 * JS Object for fetching the XML source of rulesets.
 *
 * @author Pavel Kazakov <nullishzero@gmail.com>
 */
httpsEverywhere.fetchSource = {
  // TODO: look into class constants
  CC: Components.classes,
  CI: Components.interfaces,

  // Constants for generating URL from which source will be fetched 
  BASE_SITE: 'https://gitweb.torproject.org/https-everywhere.git/plain/',
  DIRECTORY: '/src/chrome/content/rules/',
  HEAD_STRING: 'HEAD',

  /**
   * Initializes the window to view source. 
   */
  init: function() {
    var fs = httpsEverywhere.fetchSource;

    if("arguments" in window && window.arguments.length > 0) {
      var filename = window.arguments[0].xmlName;
      var id = window.arguments[0].GITCommitID; //GIT commit ID
      var URL = fs.getURL(filename, id);
      var source = fs.getSource(URL, filename, false);
    } else {
      // Should never happen
      throw 'Invalid window arguments.';
    }
  },

  /**
   * Generates a URL that can be used for viewing the ruleset source.
   *
   * @param filename    name of ruleset to view, such as EFF.xml
   * @param GITCommitID revision of ruleset
   * 
   * @return string of URL
   */
  getURL: function(filename, GITCommitID) {
    var fs = httpsEverywhere.fetchSource;
    return fs.BASE_SITE + fs.DIRECTORY + filename + "?h=" + GITCommitID;
  },

  /**
   * Sends HTTP request to view ruleset source and updates the window with the 
   * ruleset source.
   * 
   * @param URL      HTTP request will be sent to this URL
   * @param filename used for displaying ruleset source
   * @param useHead  whether send request to latest revision of ruleset
   */
  getSource: function(URL, filename, useHead) {
    var fs = httpsEverywhere.fetchSource;
    fs.setFilenameText(filename);
    fs.setPathText(URL);

    var req = fs.CC["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(fs.CI.nsIXMLHttpRequest);

    // Use HTTP GET
    req.open("GET", URL);

    // Clear User-Agent so request is pseudo-anonymous
    req.setRequestHeader("User-Agent", "");

    // handle asynchronous request
    req.onreadystatechange = function(params) {
      if (req.readyState == 4) {
        
        // HTTP Request was successful
        if (req.status == 200) {
          fs.setSourceText(req.responseText);
        } else if (!useHead) {
          // HTTP request was not successful and the request wasn't sent to 
          // get the latest revision. Therefore, if we can't fetch current 
          // revision (this project's revision might newer than lastest, for 
          // example), try to at least display the latest revision.
          var URL = fs.getURL(filename, fs.HEAD_STRING);
          fs.getSource(URL, filename, true);
        } else {
          // at least we tried...
          fs.downloadFailed();
        }
      }
    };

    req.send();
  },

  /**
   * Handle a download failure of ruleset.
   */
  downloadFailed: function() {
    document.getElementById("source-text").hidden = true;
    document.getElementById("failure-label").hidden = false;
  },


  /**
   * Convenience method for setting ruleset source text.
   *
   * @param text ruleset source
   */
  setSourceText: function(text) {
    var textBox = document.getElementById("source-text");
    textBox.value = text;
  },

  /**
   * Convenience method for setting filename text.
   *
   * @param text file name
   */
  setFilenameText: function (text) {
    var textLabel = document.getElementById("filename-text");
    textLabel.value = text;
  },

  /**
   * Convenience method for setting the path (URL) that was used to fetch
   * ruleset.
   *
   * @param text path text
   */
  setPathText: function(text) {
    var textLabel = document.getElementById("path-text");
    textLabel.value = text;
  }
};

// TODO: Test resizing on mulitple platforms
// adjust window resizing
window.addEventListener("resize", function() {
  var textBox = document.getElementById("source-text");
  // TODO: Move to constants
  textBox.width = window.innerWidth - 100;
  textBox.height = window.innerHeight - 150;
}, false);

// hook event for init
window.addEventListener("load", httpsEverywhere.fetchSource.init, false);
