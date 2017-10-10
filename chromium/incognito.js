"use strict";

(function(exports) {

// This file keeps track of incognito sessions, and clears any caches after
// an entire incognito session is closed (i.e. all incognito windows are closed).

let incognito_session_exists = false;

/**
 * Detect if an incognito session is created, so we can clear caches when it's destroyed.
 *
 * @param window: A standard Window object.
 */
function detect_incognito_creation(window) {
  if (window.incognito === true) {
    incognito_session_exists = true;
  }
}

/**
 * Clear any cache/ blacklist we have.
 * Called if an incognito session is destroyed.
 */
function destroy_caches() {
  util.log(util.DBUG, "Destroying caches.");
  background.all_rules.cookieHostCache.clear();
  background.all_rules.ruleCache.clear();
  rules.settings.domainBlacklist.clear();
  background.urlBlacklist.clear();
}

/**
 * Check if any incognito window still exists. If not, destroy caches.
 * @param arrayOfWindows: A array of all open Window objects.
 */
function check_for_incognito_session(arrayOfWindows) {
  for (let window of arrayOfWindows) {
    if (window.incognito === true) {
      // An incognito window still exists, so don't destroy caches yet.
      return;
    }
  }
  // All incognito windows have been closed.
  incognito_session_exists = false;
  destroy_caches();
}

// If a window is destroyed, and an incognito session existed, see if it still does.
function detect_incognito_destruction() {
  if (incognito_session_exists) {
    // Are any current windows incognito?
    chrome.windows.getAll(check_for_incognito_session);
  }
}


// Listen to window creation, so we can detect if an incognito window is created
if (chrome.windows) {
  chrome.windows.onCreated.addListener(detect_incognito_creation);
}

// Listen to window destruction, so we can clear caches if all incognito windows are destroyed
if (chrome.windows) {
  chrome.windows.onRemoved.addListener(detect_incognito_destruction);
}

Object.assign(exports, {});

})(typeof exports == 'undefined' ? window.incognito = {} : exports);
