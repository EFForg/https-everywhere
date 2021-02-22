"use strict";

(function(exports) {

// This file keeps track of incognito sessions, and clears any caches after
// an entire incognito session is closed (i.e. all incognito windows are closed).

let state = {
  incognito_session_exists: false,
};

function Incognito(onIncognitoDestruction) {
  Object.assign(this, {onIncognitoDestruction});
  // Listen to window creation, so we can detect if an incognito window is created
  if (chrome.windows) {
    chrome.windows.onCreated.addListener(this.detect_incognito_creation);
  }

  // Listen to window destruction, so we can clear caches if all incognito windows are destroyed
  if (chrome.windows) {
    chrome.windows.onRemoved.addListener(this.detect_incognito_destruction);
  }
}

Incognito.prototype = {
  /**
   * Detect if an incognito session is created, so we can clear caches when it's destroyed.
   *
   * @param window: A standard Window object.
   */
  detect_incognito_creation: function(window_) {
    if (window_.incognito === true) {
      state.incognito_session_exists = true;
    }
  },

  // If a window is destroyed, and an incognito session existed, see if it still does.
  detect_incognito_destruction: async function() {
    if (state.incognito_session_exists) {
      if (!(await any_incognito_windows())) {
        state.incognito_session_exists = false;
        this.onIncognitoDestruction();
      }
    }
  },
};

/**
 * Check if any incognito window still exists
 */
function any_incognito_windows() {
  return new Promise(resolve => {
    chrome.windows.getAll(arrayOfWindows => {
      for (let window_ of arrayOfWindows) {
        if (window_.incognito === true) {
          return resolve(true);
        }
      }
      resolve(false);
    });
  });
}

function onIncognitoDestruction(callback) {
  return new Incognito(callback);
};

Object.assign(exports, {
  onIncognitoDestruction,
  state,
});

})(typeof exports == 'undefined' ? require.scopes.incognito = {} : exports);
