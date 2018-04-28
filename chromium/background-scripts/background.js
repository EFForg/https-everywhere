"use strict";

(function(exports) {

const rules = require('./rules'),
  store = require('./store'),
  incognito = require('./incognito'),
  util = require('./util'),
  update = require('./update');


let all_rules = new rules.RuleSets();

async function initialize() {
  await store.initialize();
  await store.performMigrations();
  await initializeStoredGlobals();
  await getUpgradeToSecureAvailable();
  await update.initialize(store, initializeAllRules);
  await all_rules.loadFromBrowserStorage(store, update.applyStoredRulesets);
  await incognito.onIncognitoDestruction(destroy_caches);
}
initialize();

async function initializeAllRules() {
  const r = new rules.RuleSets();
  await r.loadFromBrowserStorage(store, update.applyStoredRulesets);
  Object.assign(all_rules, r);
}

/**
 * Load preferences. Structure is:
 *  {
 *    httpNowhere: Boolean,
 *    showCounter: Boolean,
 *    isExtensionEnabled: Boolean
 *  }
 */
var httpNowhereOn = false;
var showCounter = true;
var isExtensionEnabled = true;

function initializeStoredGlobals(){
  return new Promise(resolve => {
    store.get({
      httpNowhere: false,
      showCounter: true,
      globalEnabled: true,
      enableMixedRulesets: false
    }, function(item) {
      httpNowhereOn = item.httpNowhere;
      showCounter = item.showCounter;
      isExtensionEnabled = item.globalEnabled;
      updateState();

      rules.settings.enableMixedRulesets = item.enableMixedRulesets;

      resolve();
    });
  });
}

let upgradeToSecureAvailable;

function getUpgradeToSecureAvailable() {
  if (typeof browser !== 'undefined') {
    return browser.runtime.getBrowserInfo().then(function(info) {
      let version = info.version.match(/^(\d+)/)[1];
      if (info.name == "Firefox" && version >= 59) {
        upgradeToSecureAvailable = true;
      } else {
        upgradeToSecureAvailable = false;
      }
    });
  } else {
    return new Promise(resolve => {
      upgradeToSecureAvailable = false;
      resolve();
    });
  }
}

chrome.storage.onChanged.addListener(async function(changes, areaName) {
  if (areaName === 'sync' || areaName === 'local') {
    if ('httpNowhere' in changes) {
      httpNowhereOn = changes.httpNowhere.newValue;
      updateState();
    }
    if ('showCounter' in changes) {
      showCounter = changes.showCounter.newValue;
      updateState();
    }
    if ('globalEnabled' in changes) {
      isExtensionEnabled = changes.globalEnabled.newValue;
      updateState();
    }
    if ('enableMixedRulesets' in changes) {
      // Don't require users to restart the browsers
      rules.settings.enableMixedRulesets = changes.enableMixedRulesets.newValue;
      initializeAllRules();
    }
    if ('debugging_rulesets' in changes) {
      initializeAllRules();
    }
  }
});

if (chrome.tabs) {
  chrome.tabs.onActivated.addListener(function() {
    updateState();
  });
}
if (chrome.windows) {
  chrome.windows.onFocusChanged.addListener(function() {
    updateState();
  });
}
chrome.webNavigation.onCompleted.addListener(function() {
  updateState();
});

// Records which tabId's are active in the HTTPS Switch Planner (see
// pages/devtools/panel-ux.js).
var switchPlannerEnabledFor = {};
// Detailed information recorded when the HTTPS Switch Planner is active.
// Structure is:
//   switchPlannerInfo[tabId]["rw"/"nrw"][resource_host][active_content][url];
// rw / nrw stand for "rewritten" versus "not rewritten"
var switchPlannerInfo = {};

/**
 * Set the icon color correctly
 * active: extension is enabled.
 * blocking: extension is in "block all HTTP requests" mode.
 * disabled: extension is disabled from the popup menu.
 */

function updateState () {
  if (!chrome.tabs) return;

  let iconState = 'active';

  if (!isExtensionEnabled) {
    iconState = 'disabled';
  } else if (httpNowhereOn) {
    iconState = 'blocking';
  }

  if ('setIcon' in chrome.browserAction) {
    chrome.browserAction.setIcon({
      path: {
        38: 'images/icons/icon-' + iconState + '-38.png'
      }
    });
  }

  chrome.browserAction.setTitle({
    title: 'HTTPS Everywhere' + ((iconState === 'active') ? '' : ' (' + iconState + ')')
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || tabs.length === 0) {
      return;
    }
    const tabId = tabs[0].id;
    const activeCount = appliedRulesets.getActiveRulesetCount(tabId);

    if ('setBadgeBackgroundColor' in chrome.browserAction) {
      chrome.browserAction.setBadgeBackgroundColor({ color: '#666666', tabId });
    }

    const showBadge = activeCount > 0 && isExtensionEnabled && showCounter;

    if ('setBadgeText' in chrome.browserAction) {
      chrome.browserAction.setBadgeText({ text: showBadge ? String(activeCount) : '', tabId });
    }
  });
}

/**
 * The following allows fennec to interact with the popup ui
 * */
chrome.browserAction.onClicked.addListener(e => {
  const url = chrome.extension.getURL("/pages/popup/index.html?tabId=" + e.id);
  chrome.tabs.create({
    url
  });
});



/**
 * Add a listener for removed tabs
 */
function AppliedRulesets() {
  this.active_tab_rules = new Map();
  this.active_tab_main_frames = new Map();

  let that = this;
  if (chrome.tabs) {
    chrome.tabs.onRemoved.addListener(function(tabId) {
      that.removeTab(tabId);
    });
  }
}

AppliedRulesets.prototype = {
  addRulesetToTab: function(tabId, type, ruleset) {
    if (!this.active_tab_main_frames.has(tabId)) {
      this.active_tab_main_frames.set(tabId, false);
    }

    // always show main_frame ruleset on the top
    if (type == "main_frame") {
      this.active_tab_main_frames.set(tabId, true);
      this.active_tab_rules.set(tabId, [ruleset,]);
      return ;
    }

    if (this.active_tab_rules.has(tabId)) {
      let rulesets = this.active_tab_rules.get(tabId);
      let insertIndex = 0;

      const ruleset_name = ruleset.name.toLowerCase();

      for (const item of rulesets) {
        const item_name = item.name.toLowerCase();

        if (item_name == ruleset_name) {
          return ;
        } else if (insertIndex == 0 && this.active_tab_main_frames.get(tabId)) {
          insertIndex = 1;
        } else if (item_name < ruleset_name) {
          insertIndex++;
        }
      }
      rulesets.splice(insertIndex, 0, ruleset);
    } else {
      this.active_tab_rules.set(tabId, [ruleset,]);
    }
  },

  getRulesets: function(tabId) {
    if (this.active_tab_rules.has(tabId)) {
      return this.active_tab_rules.get(tabId);
    } else {
      return null;
    }
  },

  removeTab: function(tabId) {
    this.active_tab_rules.delete(tabId);
    this.active_tab_main_frames.delete(tabId);
  },

  getActiveRulesetCount: function (tabId) {
    let activeCount = 0;

    const rulesets = this.getRulesets(tabId);
    if (rulesets) {
      for (const ruleset of rulesets) {
        if (ruleset.active) {
          activeCount++;
        }
      }
    }
    return activeCount;
  }
};

var appliedRulesets = new AppliedRulesets();

var urlBlacklist = new Set();

// redirect counter workaround
// TODO: Remove this code if they ever give us a real counter
var redirectCounter = new Map();

/**
 * Called before a HTTP(s) request. Does the heavy lifting
 * Cancels the request/redirects it to HTTPS. URL modification happens in here.
 * @param details of the handler, see Chrome doc
 * */
function onBeforeRequest(details) {
  // If HTTPSe has been disabled by the user, return immediately.
  if (!isExtensionEnabled) {
    return;
  }

  let uri = new URL(details.url);

  // Normalise hosts with tailing dots, e.g. "www.example.com."
  let canonical_host = uri.hostname;
  while (canonical_host.charAt(canonical_host.length - 1) == ".") {
    canonical_host = canonical_host.slice(0, -1);
    uri.hostname = canonical_host;
  }

  // Should the request be canceled?
  // true if the URL is a http:// connection to a remote canonical host, and not
  // a tor hidden service
  const shouldCancel = httpNowhereOn &&
    uri.protocol === 'http:' &&
    uri.hostname.slice(-6) !== '.onion' &&
    uri.hostname !== 'localhost' &&
    !/^127(\.[0-9]{1,3}){3}$/.test(canonical_host) &&
    !/^0\.0\.0\.0$/.test(canonical_host) &&
    uri.hostname !== '[::1]';

  // If there is a username / password, put them aside during the ruleset
  // analysis process
  let using_credentials_in_url = false;
  let tmp_user;
  let tmp_pass;
  if (uri.password || uri.username) {
    using_credentials_in_url = true;
    tmp_user = uri.username;
    tmp_pass = uri.password;
    uri.username = '';
    uri.password = '';
  }

  var canonical_url = uri.href;
  if (details.url != canonical_url && !using_credentials_in_url) {
    util.log(util.INFO, "Original url " + details.url +
        " changed before processing to " + canonical_url);
  }
  if (urlBlacklist.has(canonical_url)) {
    return {cancel: shouldCancel};
  }

  if (details.type == "main_frame") {
    appliedRulesets.removeTab(details.tabId);
  }

  var potentiallyApplicable = all_rules.potentiallyApplicableRulesets(canonical_host);

  if (redirectCounter.get(details.requestId) >= 8) {
    util.log(util.NOTE, "Redirect counter hit for " + canonical_url);
    urlBlacklist.add(canonical_url);
    rules.settings.domainBlacklist.add(canonical_host);
    util.log(util.WARN, "Domain blacklisted " + canonical_host);
    return {cancel: shouldCancel};
  }

  // whether to use mozilla's upgradeToSecure BlockingResponse if available
  let upgradeToSecure = false;
  var newuristr = null;
  // check rewritten URIs against the trivially upgraded URI
  let trivialUpgradeUri = canonical_url.replace(/^http:/, "https:");

  for (let ruleset of potentiallyApplicable) {
    appliedRulesets.addRulesetToTab(details.tabId, details.type, ruleset);
    if (ruleset.active && !newuristr) {
      newuristr = ruleset.apply(canonical_url);
      // only use upgradeToSecure for trivial rulesets
      if (newuristr == trivialUpgradeUri) {
        upgradeToSecure = true;
      }
    }
  }

  // re-insert userpass info which was stripped temporarily
  if (using_credentials_in_url) {
    if (newuristr) {
      const uri_with_credentials = new URL(newuristr);
      uri_with_credentials.username = tmp_user;
      uri_with_credentials.password = tmp_pass;
      newuristr = uri_with_credentials.href;
    } else {
      const canonical_url_with_credentials = new URL(canonical_url);
      canonical_url_with_credentials.username = tmp_user;
      canonical_url_with_credentials.password = tmp_pass;
      canonical_url = canonical_url_with_credentials.href;
    }
  }

  // In Switch Planner Mode, record any non-rewriteable
  // HTTP URIs by parent hostname, along with the resource type.
  if (switchPlannerEnabledFor[details.tabId] && uri.protocol !== "https:") {
    writeToSwitchPlanner(details.type,
      details.tabId,
      canonical_host,
      details.url,
      newuristr);
  }

  if (httpNowhereOn) {
    // If loading a main frame, try the HTTPS version as an alternative to
    // failing.
    if (shouldCancel) {
      upgradeToSecure = true;
      if (!newuristr) {
        newuristr = canonical_url.replace(/^http:/, "https:");
      } else {
        newuristr = newuristr.replace(/^http:/, "https:");
      }
    }
    if (newuristr && newuristr.substring(0, 5) === "http:") {
      // Abort early if we're about to redirect to HTTP in HTTP Nowhere mode
      return {cancel: true};
    }
  }

  if (upgradeToSecureAvailable && upgradeToSecure) {
    util.log(util.INFO, 'onBeforeRequest returning upgradeToSecure: true');
    return {upgradeToSecure: true};
  } else if (newuristr) {
    util.log(util.INFO, 'onBeforeRequest returning redirectUrl: ' + newuristr);
    return {redirectUrl: newuristr};
  } else {
    util.log(util.INFO, 'onBeforeRequest returning shouldCancel: ' + shouldCancel);
    return {cancel: shouldCancel};
  }
}


// Map of which values for the `type' enum denote active vs passive content.
// https://developer.chrome.com/extensions/webRequest.html#event-onBeforeRequest
const mixedContentTypes = {
  object: 1, other: 1, script: 1, stylesheet: 1, sub_frame: 1, xmlhttprequest: 1,
  image: 0, main_frame: 0
};

/**
 * Record a non-HTTPS URL loaded by a given hostname in the Switch Planner, for
 * use in determining which resources need to be ported to HTTPS.
 * (Reminder: Switch planner is the pro-tool enabled by switching into debug-mode)
 *
 * @param type: type of the resource (see activeTypes and passiveTypes arrays)
 * @param tab_id: The id of the tab
 * @param resource_host: The host of the original url
 * @param resource_url: the original url
 * @param rewritten_url: The url rewritten to
 * */
function writeToSwitchPlanner(type, tab_id, resource_host, resource_url, rewritten_url) {
  let rw = rewritten_url ? "rw" : "nrw";

  let active_content = 1;
  if (mixedContentTypes.hasOwnProperty(type)) {
    active_content = mixedContentTypes[type];
  } else {
    util.log(util.WARN, "Unknown type from onBeforeRequest details: `" + type + "', assuming active");
  }

  if (!switchPlannerInfo[tab_id]) {
    switchPlannerInfo[tab_id] = {};
    switchPlannerInfo[tab_id]["rw"] = {};
    switchPlannerInfo[tab_id]["nrw"] = {};
  }
  if (!switchPlannerInfo[tab_id][rw][resource_host])
    switchPlannerInfo[tab_id][rw][resource_host] = {};
  if (!switchPlannerInfo[tab_id][rw][resource_host][active_content])
    switchPlannerInfo[tab_id][rw][resource_host][active_content] = {};

  switchPlannerInfo[tab_id][rw][resource_host][active_content][resource_url] = 1;
}

/**
 * Return the number of properties in an object. For associative maps, this is
 * their size.
 * @param obj: object to calc the size for
 * */
function objSize(obj) {
  if (typeof obj == 'undefined') return 0;
  var size = 0, key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) size++;
  }
  return size;
}

/**
 * Make an array of asset hosts by score so we can sort them,
 * presenting the most important ones first.
 * */
function sortSwitchPlanner(tab_id, rewritten) {
  var asset_host_list = [];
  if (typeof switchPlannerInfo[tab_id] === 'undefined' ||
      typeof switchPlannerInfo[tab_id][rewritten] === 'undefined') {
    return [];
  }
  var tabInfo = switchPlannerInfo[tab_id][rewritten];
  for (var asset_host in tabInfo) {
    var ah = tabInfo[asset_host];
    var activeCount = objSize(ah[1]);
    var passiveCount = objSize(ah[0]);
    var score = activeCount * 100 + passiveCount;
    asset_host_list.push([score, activeCount, passiveCount, asset_host]);
  }
  asset_host_list.sort(function(a,b){return a[0]-b[0];});
  return asset_host_list;
}

/**
 * monitor cookie changes. Automatically convert them to secure cookies
 * @param changeInfo Cookie changed info, see Chrome doc
 * */
function onCookieChanged(changeInfo) {
  if (!changeInfo.removed && !changeInfo.cookie.secure && isExtensionEnabled) {
    if (all_rules.shouldSecureCookie(changeInfo.cookie)) {
      let cookie = {
        name:changeInfo.cookie.name,
        value:changeInfo.cookie.value,
        path:changeInfo.cookie.path,
        httpOnly:changeInfo.cookie.httpOnly,
        expirationDate:changeInfo.cookie.expirationDate,
        storeId:changeInfo.cookie.storeId,
        secure: true
      };

      // Host-only cookies don't set the domain field.
      if (!changeInfo.cookie.hostOnly) {
        cookie.domain = changeInfo.cookie.domain;
      }

      // Chromium cookie sameSite status, see https://tools.ietf.org/html/draft-west-first-party-cookies
      if (changeInfo.cookie.sameSite) {
        cookie.sameSite = changeInfo.cookie.sameSite;
      }

      // Firefox first-party isolation
      if (changeInfo.cookie.firstPartyDomain) {
        cookie.firstPartyDomain = changeInfo.cookie.firstPartyDomain;
      }

      // The cookie API is magical -- we must recreate the URL from the domain and path.
      if (changeInfo.cookie.domain[0] == ".") {
        cookie.url = "https://www" + changeInfo.cookie.domain + cookie.path;
      } else {
        cookie.url = "https://" + changeInfo.cookie.domain + cookie.path;
      }
      // We get repeated events for some cookies because sites change their
      // value repeatedly and remove the "secure" flag.
      util.log(util.DBUG,
        "Securing cookie " + cookie.name + " for " + changeInfo.cookie.domain + ", was secure=" + changeInfo.cookie.secure);
      chrome.cookies.set(cookie);
    }
  }
}

/**
 * handling redirects, breaking loops
 * @param details details for the redirect (see chrome doc)
 * */
function onBeforeRedirect(details) {
  // Catch redirect loops (ignoring about:blank, etc. caused by other extensions)
  let prefix = details.redirectUrl.substring(0, 5);
  if (prefix === "http:" || prefix === "https") {
    let count = redirectCounter.get(details.requestId);
    if (count) {
      redirectCounter.set(details.requestId, count + 1);
      util.log(util.DBUG, "Got redirect id "+details.requestId+
                ": "+count);
    } else {
      redirectCounter.set(details.requestId, 1);
    }
  }
}

/**
 * handle webrequest.onCompleted, cleanup redirectCounter
 * @param details details for the chrome.webRequest (see chrome doc)
 */
function onCompleted(details) {
  if (redirectCounter.has(details.requestId)) {
    redirectCounter.delete(details.requestId);
  }
}

/**
 * handle webrequest.onErrorOccurred, cleanup redirectCounter
 * @param details details for the chrome.webRequest (see chrome doc)
 */
function onErrorOccurred(details) {
  if (redirectCounter.has(details.requestId)) {
    redirectCounter.delete(details.requestId);
  }
}

/**
 * handle webrequest.onHeadersReceived, insert upgrade-insecure-requests directive
 * @param details details for the chrome.webRequest (see chrome doc)
 */
function onHeadersReceived(details) {
  if (isExtensionEnabled && httpNowhereOn) {
    // Do not upgrade the .onion requests in HTTP Nowhere Mode,
    // See https://github.com/EFForg/https-everywhere/pull/14600#discussion_r168072480
    const uri = new URL(details.url);
    if (uri.hostname.slice(-6) == '.onion') {
      return {};
    }

    for (const idx in details.responseHeaders) {
      if (details.responseHeaders[idx].name.match(/Content-Security-Policy/i)) {
        // Existing CSP headers found
        const value = details.responseHeaders[idx].value;

        // Prepend if no upgrade-insecure-requests directive exists
        if (!value.match(/upgrade-insecure-requests/i)) {
          details.responseHeaders[idx].value = "upgrade-insecure-requests; " + value;
          return {responseHeaders: details.responseHeaders};
        }
        return {};
      }
    }

    // CSP headers not found
    const upgradeInsecureRequests = {
      name: 'Content-Security-Policy',
      value: 'upgrade-insecure-requests'
    }
    details.responseHeaders.push(upgradeInsecureRequests);
    return {responseHeaders: details.responseHeaders};
  }
  return {};
}

// Registers the handler for requests
// See: https://github.com/EFForg/https-everywhere/issues/10039
chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ["*://*/*"]}, ["blocking"]);

// Try to catch redirect loops on URLs we've redirected to HTTPS.
chrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, {urls: ["https://*/*"]});

// Cleanup redirectCounter if neccessary
chrome.webRequest.onCompleted.addListener(onCompleted, {urls: ["*://*/*"]});

// Cleanup redirectCounter if neccessary
chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, {urls: ["*://*/*"]})

// Insert upgrade-insecure-requests directive in httpNowhere mode
chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {urls: ["https://*/*"]}, ["blocking", "responseHeaders"]);

// Listen for cookies set/updated and secure them if applicable. This function is async/nonblocking.
chrome.cookies.onChanged.addListener(onCookieChanged);


/**
 * disable switch Planner
 * @param tabId the Tab to disable for
 */
function disableSwitchPlannerFor(tabId) {
  delete switchPlannerEnabledFor[tabId];
  // Clear stored URL info.
  delete switchPlannerInfo[tabId];
}

/**
 * Enable switch planner for specific tab
 * @param tabId the tab to enable it for
 */
function enableSwitchPlannerFor(tabId) {
  switchPlannerEnabledFor[tabId] = true;
}

// Listen for connection from the DevTools panel so we can set up communication.
chrome.runtime.onConnect.addListener(function (port) {
  if (port.name == "devtools-page") {
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
      var tabId = message.tabId;

      var disableOnCloseCallback = function() {
        util.log(util.DBUG, "Devtools window for tab " + tabId + " closed, clearing data.");
        disableSwitchPlannerFor(tabId);
      };

      if (message.type === "enable") {
        enableSwitchPlannerFor(tabId);
        port.onDisconnect.addListener(disableOnCloseCallback);
      } else if (message.type === "disable") {
        disableSwitchPlannerFor(tabId);
      } else if (message.type === "getHosts") {
        sendResponse({
          nrw: sortSwitchPlanner(tabId, "nrw"),
          rw: sortSwitchPlanner(tabId, "rw")
        });
      }
    });
  }
});

// This is necessary for communication with the popup in Firefox Private
// Browsing Mode, see https://bugzilla.mozilla.org/show_bug.cgi?id=1329304
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
  if (message.type == "get_option") {
    store.get(message.object, sendResponse);
    return true;
  } else if (message.type == "set_option") {
    store.set(message.object, item => {
      if (sendResponse) {
        sendResponse(item);
      }
    });
  } else if (message.type == "delete_from_ruleset_cache") {
    all_rules.ruleCache.delete(message.object);
  } else if (message.type == "get_active_rulesets") {
    sendResponse(appliedRulesets.getRulesets(message.object));
  } else if (message.type == "set_ruleset_active_status") {
    let rulesets = appliedRulesets.getRulesets(message.object.tab_id);

    for (let ruleset of rulesets) {
      if (ruleset.name == message.object.name) {
        ruleset.active = message.object.active;
        if (ruleset.default_state == message.object.active) {
          message.object.active = undefined;
        }
        break;
      }
    }

    all_rules.setRuleActiveState(message.object.name, message.object.active).then(() => {
      sendResponse(true);
    });
    return true;
  } else if (message.type == "add_new_rule") {
    all_rules.addNewRuleAndStore(message.object).then(() => {
      sendResponse(true);
    });
    return true;
  } else if (message.type == "remove_rule") {
    all_rules.removeRuleAndStore(message.object);
  } else if (message.type == "import_settings") {
    // This is used when importing settings from the options ui
    import_settings(message.object).then(() => {
      sendResponse(true);
    });
  } else if (message.type == "get_ruleset_timestamps") {
    update.getRulesetTimestamps().then(timestamps => sendResponse(timestamps));
    return true;
  }
});

/**
 * Import extension settings (custom rulesets, ruleset toggles, globals) from an object
 * @param settings the settings object
 */
async function import_settings(settings) {
  if (settings && settings.changed) {
    let ruleActiveStates = {};
    // Load all the ruleset toggles into memory and store
    for (const ruleset_name in settings.rule_toggle) {
      ruleActiveStates[ruleset_name] = (settings.rule_toggle[ruleset_name] == "true");
    }

    // Save settings
    await new Promise(resolve => {
      store.set({
        legacy_custom_rulesets: settings.custom_rulesets,
        httpNowhere: settings.prefs.http_nowhere_enabled,
        showCounter: settings.prefs.show_counter,
        globalEnabled: settings.prefs.global_enabled,
        ruleActiveStates
      }, resolve);
    });

    initializeAllRules();
  }
}

/**
 * Clear any cache/ blacklist we have.
 */
function destroy_caches() {
  util.log(util.DBUG, "Destroying caches.");
  all_rules.cookieHostCache.clear();
  all_rules.ruleCache.clear();
  rules.settings.domainBlacklist.clear();
  urlBlacklist.clear();
}

Object.assign(exports, {
  all_rules,
  urlBlacklist,
  sortSwitchPlanner,
  switchPlannerInfo
});

})(typeof exports == 'undefined' ? require.scopes.background = {} : exports);
