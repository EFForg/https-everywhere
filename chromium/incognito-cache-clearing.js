
// This file keeps track of incognito sessions, and clears any caches after
// an entire incognito session is closed (i.e. all incognito windows are closed).

let incognitoSessionExists = false

/**
 * Detect if an incognito session is created, so we can clear caches when it's destroyed.
 *
 * @param window: A standard Window object.
 */
function detectIncognitoCreation (window) {
  if (window.incognito === true) {
    incognitoSessionExists = true
  }
}

/**
 * Clear any caches we have.
 * Called if an incognito session is destroyed.
 */
function destroyCaches () {
  log(DBUG, 'Destroying caches.')
  allRules.cookieHostCache.clear()
  allRules.ruleCache.clear()
}

/**
 * Check if any incognito window still exists. If not, destroy caches.
 * @param arrayOfWindows: A array of all open Window objects.
 */
function checkForIncognitoSession (arrayOfWindows) {
  for (let window of arrayOfWindows) {
    if (window.incognito === true) {
      // An incognito window still exists, so don't destroy caches yet.
      return
    }
  }
  // All incognito windows have been closed.
  incognitoSessionExists = false
  destroyCaches()
}

/**
 * If a window is destroyed, and an incognito session existed, see if it still does.
 *
 * @param windowId: Ignored.
 */
function detectIncognitoDestruction (windowId) {
  if (incognitoSessionExists) {
    // Are any current windows incognito?
    chrome.windows.getAll(checkForIncognitoSession)
  }
}

// Listen to window creation, so we can detect if an incognito window is created
chrome.windows.onCreated.addListener(detectIncognitoCreation)

// Listen to window destruction, so we can clear caches if all incognito windows are destroyed
chrome.windows.onRemoved.addListener(detectIncognitoDestruction)
