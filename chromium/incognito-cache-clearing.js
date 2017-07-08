'use strict'

;(function () {
  // This file keeps track of incognito sessions, and clears any caches after
  // an entire incognito session is closed (i.e. all incognito windows are closed).

  let incognitoSessionExists = false;

  /**
   * Detect if an incognito session is created, so we can clear caches when it's destroyed.
   *
   * @param window: A standard Window object.
   */
  function detectIncognitoCreation(window) {
    if (window.incognito === true) {
      incognitoSessionExists = true;
    }
  }

  /**
   * Clear any caches we have.
   * Called if an incognito session is destroyed.
   */
  function destroyCaches() {
    window.log(window.DBUG, 'Destroying caches.');
    window.allRules.cookieHostCache.clear();
    window.allRules.ruleCache.clear();
  }

  /**
   * Check if any incognito window still exists. If not, destroy caches.
   * @param arrayOfWindows: A array of all open Window objects.
   */
  function checkForIncognitoSession(arrayOfWindows) {
    incognitoSessionExists = arrayOfWindows.some(wnd => wnd.incognito);

    if (!incognitoSessionExists) {
      // All incognito windows have been closed.
      destroyCaches();
    }
  }

  /**
   * If a window is destroyed, and an incognito session existed, see if it still does.
   */
  function detectIncognitoDestruction() {
    if (incognitoSessionExists) {
      // Are any current windows incognito?
      chrome.windows.getAll(checkForIncognitoSession);
    }
  }

  // Listen to window creation, so we can detect if an incognito window is created
  chrome.windows.onCreated.addListener(detectIncognitoCreation);

  // Listen to window destruction, so we can clear caches if all incognito windows are destroyed
  chrome.windows.onRemoved.addListener(detectIncognitoDestruction);
}());
