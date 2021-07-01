"use strict";

(function(exports) {

const rules = require('./rules'),
  store = require('./store'),
  incognito = require('./incognito'),
  util = require('./util'),
  update = require('./update'),
  { update_channels } = require('./update_channels'),
  wasm = require('./wasm'),
  ipUtils = require('./ip_utils'),
  ssl_codes = require('./ssl_codes');

let all_rules = new rules.RuleSets();
let blooms = [];

async function initialize() {
  await wasm.initialize();
  await store.initialize();
  await store.performMigrations();
  await initializeStoredGlobals();
  await getUpgradeToSecureAvailable();
  await update.initialize(store, initializeAllRules);
  await all_rules.loadFromBrowserStorage(store, update.applyStoredRulesets);
  await update.applyStoredBlooms(blooms);
  await incognito.onIncognitoDestruction(destroy_caches);
}
initialize();

async function initializeAllRules() {
  const r = new rules.RuleSets();
  await r.loadFromBrowserStorage(store, update.applyStoredRulesets);
  Object.assign(all_rules, r);
  blooms.length = 0;
  await update.applyStoredBlooms(blooms);
}

/**
 * Load preferences. Structure is:
 *  {
 *    httpNowhere: Boolean,
 *    isExtensionEnabled: Boolean
 *  }
 */
var httpNowhereOn = false;
var isExtensionEnabled = true;
let disabledList = new Set();
let httpOnceList = new Set();

/**
 * Check if HTTPS Everywhere should be ON for host
 */
function isExtensionDisabledOnSite(host) {
  // make sure the host is not matched in the httpOnceList
  if (httpOnceList.has(host)) {
    return true;
  }

  // make sure the host is not matched in the disabledList
  if (disabledList.has(host)) {
    return true;
  }

  // make sure the host is matched by any wildcard expressions in the disabledList
  const experessions = util.getWildcardExpressions(host);
  for (const expression of experessions) {
    if (disabledList.has(expression)) {
      return true;
    }
  }

  // otherwise return false
  return false;
}

function initializeStoredGlobals() {
  return new Promise(resolve => {
    store.get({
      httpNowhere: false,
      globalEnabled: true,
      enableMixedRulesets: false,
      disabledList: []
    }, function(item) {
      httpNowhereOn = item.httpNowhere;
      isExtensionEnabled = item.globalEnabled;
      for (let disabledSite of item.disabledList) {
        disabledList.add(disabledSite);
      }
      updateState();

      rules.settings.enableMixedRulesets = item.enableMixedRulesets;

      resolve();
    });
  });
}

/** @type {boolean} */
let upgradeToSecureAvailable = false;

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

  // Grant access to HTTP site only during session, clear once window is closed
  chrome.windows.onRemoved.addListener(function() {
    chrome.windows.getAll({}, function(windows) {
      if(windows.length > 0) {
        return;
      } else {
        httpOnceList.clear();
      }
    });
  });

}
chrome.webNavigation.onCompleted.addListener(function() {
  updateState();
});

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

  chrome.browserAction.setTitle({
    title: 'HTTPS Everywhere' + ((iconState === 'active') ? '' : ' (' + iconState + ')')
  });

  const chromeUrl = 'chrome://';

  chrome.tabs.query({ active: true, currentWindow: true, status: 'complete' }, function(tabs) {
    if (!tabs || tabs.length === 0 || tabs[0].url.startsWith(chromeUrl) ) {
      return;
    }

    // tabUrl.host instead of hostname should be used to show the "disabled" status properly (#19293)
    const tabUrl = new URL(tabs[0].url);
    const host = util.getNormalisedHostname(tabUrl.host);

    if (isExtensionDisabledOnSite(host) || iconState == "disabled") {
      if ('setIcon' in chrome.browserAction) {
        chrome.browserAction.setIcon({
          path: {
            38: 'images/icons/icon-disabled-38.png'
          }
        });
      }
    } else {
      if ('setIcon' in chrome.browserAction) {
        chrome.browserAction.setIcon({
          path: {
            38: 'images/icons/icon-' + iconState + '-38.png'
          }
        });
      }
    }
  });
}

/**
 * The following allows fennec to interact with the popup ui
 * */
chrome.browserAction.onClicked.addListener(e => {
  const url = chrome.runtime.getURL("/pages/popup/index.html?tabId=" + e.id);
  chrome.tabs.create({
    url
  });
});

/**
 * A centralized storage for browsing data within the browser session.
 */
function BrowserSession() {
  this.tabs = new Map();
  this.requests = new Map();

  if (chrome.tabs) {
    chrome.tabs.onRemoved.addListener(tabId => {
      this.deleteTab(tabId);
    });
  }
}

BrowserSession.prototype = {
  putTab: function(tabId, key, value, overwrite) {
    if (!this.tabs.has(tabId)) {
      this.tabs.set(tabId, {});
    }

    if (!(key in this.tabs.get(tabId)) || overwrite) {
      this.tabs.get(tabId)[key] = value;
    }
  },

  getTab: function(tabId, key, defaultValue) {
    if (this.tabs.has(tabId) && key in this.tabs.get(tabId)) {
      return this.tabs.get(tabId)[key];
    }
    return defaultValue;
  },

  deleteTab: function(tabId) {
    if (this.tabs.has(tabId)) {
      this.tabs.delete(tabId);
    }
  },

  putTabAppliedRulesets: function(tabId, type, ruleset) {
    this.putTab(tabId, "main_frame", false, false);

    // always show main_frame ruleset on the top
    if (type == "main_frame") {
      this.putTab(tabId, "main_frame", true, true);
      this.putTab(tabId, "applied_rulesets", [ruleset,], true);
      return ;
    }

    // sort by ruleset names alphabetically, case-insensitive
    if (this.getTab(tabId, "applied_rulesets", null)) {
      let rulesets = this.getTab(tabId, "applied_rulesets", null);
      let insertIndex = 0;

      const ruleset_name = ruleset.name.toLowerCase();

      for (const item of rulesets) {
        const item_name = item.name.toLowerCase();

        if (item_name == ruleset_name) {
          return ;
        } else if (insertIndex == 0 && this.getTab(tabId, "main_frame", false)) {
          insertIndex = 1;
        } else if (item_name < ruleset_name) {
          insertIndex++;
        }
      }
      rulesets.splice(insertIndex, 0, ruleset);
    } else {
      this.putTab(tabId, "applied_rulesets", [ruleset,], true);
    }
  },

  getTabAppliedRulesets: function(tabId) {
    return this.getTab(tabId, "applied_rulesets", null);
  },

  putRequest: function(requestId, key, value) {
    if (!this.requests.has(requestId)) {
      this.requests.set(requestId, {});
    }
    this.requests.get(requestId)[key] = value;
  },

  getRequest: function(requestId, key, defaultValue) {
    if (this.requests.has(requestId) && key in this.requests.get(requestId)) {
      return this.requests.get(requestId)[key];
    }
    return defaultValue;
  },

  deleteRequest: function(requestId) {
    if (this.requests.has(requestId)) {
      this.requests.delete(requestId);
    }
  }
};

let browserSession = new BrowserSession();

var urlBlacklist = new Set();

const cancelUrl = chrome.runtime.getURL("/pages/cancel/index.html");

function redirectOnCancel(shouldCancel, originURL) {
  return shouldCancel ? {redirectUrl: newCancelUrl(originURL)} : {cancel: false};
}

const newCancelUrl = originURL => `${cancelUrl}?originURL=${encodeURIComponent(originURL)}`;

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
  uri.hostname = util.getNormalisedHostname(uri.hostname);

  let ip = ipUtils.parseIp(uri.hostname);

  let isLocalIp = false;

  if (ip !== -1) {
    isLocalIp = ipUtils.isLocalIp(ip);
  }

  if (details.type == "main_frame") {
    // Clear the content from previous browser session.
    // This needed to be done before this listener returns,
    // otherwise, the extension popup might include rulesets
    // from previous page.
    browserSession.deleteTab(details.tabId);

    // Check if an user has disabled HTTPS Everywhere on this site.  We should
    // ensure that all subresources are not run through HTTPS Everywhere as well.
    browserSession.putTab(details.tabId, 'first_party_host', uri.host, true);
  }

  if (isExtensionDisabledOnSite(browserSession.getTab(details.tabId, 'first_party_host', null))) {
    return;
  }

  // Should the request be canceled?
  // true if the URL is a http:// connection to a remote canonical host, and not
  // a tor hidden service
  const shouldCancel = httpNowhereOn &&
    (uri.protocol === 'http:' || uri.protocol === 'ftp:') &&
    uri.hostname.slice(-6) !== '.onion' &&
    uri.hostname !== 'localhost' &&
    !uri.hostname.endsWith('.localhost') &&
    uri.hostname !== '[::1]' &&
    !isLocalIp;

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

  if (details.url != uri.href && !using_credentials_in_url) {
    util.log(util.INFO, "Original url " + details.url +
        " changed before processing to " + uri.href);
  }
  if (urlBlacklist.has(uri.href)) {
    return redirectOnCancel(shouldCancel, details.url);
  }

  if (browserSession.getRequest(details.requestId, "redirect_count", 0) >= 8) {
    util.log(util.NOTE, "Redirect counter hit for " + uri.href);
    urlBlacklist.add(uri.href);
    rules.settings.domainBlacklist.add(uri.hostname);
    util.log(util.WARN, "Domain blacklisted " + uri.hostname);
    return redirectOnCancel(shouldCancel, details.url);
  }

  // whether to use mozilla's upgradeToSecure BlockingResponse if available
  let upgradeToSecure = false;
  let newuristr = null;

  let potentiallyApplicable = all_rules.potentiallyApplicableRulesets(uri.hostname);

  for (let ruleset of potentiallyApplicable) {
    if (details.url.match(ruleset.scope)) {
      browserSession.putTabAppliedRulesets(details.tabId, details.type, ruleset);
      if (ruleset.active && !newuristr) {
        newuristr = ruleset.apply(uri.href);
      }
    }
  }

  if (newuristr == null && blooms.length > 0 && uri.protocol === 'http:') {
    for(let bloom of blooms) {
      if(bloom.check(uri.hostname)) {
        newuristr = uri.href.replace(/^http:/, "https:");
        break;
      }
    }
  }

  // only use upgradeToSecure for trivial rewrites
  if (upgradeToSecureAvailable && newuristr) {
    // check rewritten URIs against the trivially upgraded URI
    const trivialUpgradeUri = uri.href.replace(/^http:/, "https:");
    upgradeToSecure = (newuristr == trivialUpgradeUri);
  }

  // re-insert userpass info which was stripped temporarily
  if (using_credentials_in_url) {
    if (newuristr) {
      const uri_with_credentials = new URL(newuristr);
      uri_with_credentials.username = tmp_user;
      uri_with_credentials.password = tmp_pass;
      newuristr = uri_with_credentials.href;
    } else {
      const url_with_credentials = new URL(uri.href);
      url_with_credentials.username = tmp_user;
      url_with_credentials.password = tmp_pass;
      uri.href = url_with_credentials.href;
    }
  }

  if (httpNowhereOn) {
    // If loading a main frame, try the HTTPS version as an alternative to
    // failing.
    if (shouldCancel) {
      if (!newuristr) {
        newuristr = uri.href.replace(/^http:/, "https:");
        browserSession.putRequest(details.requestId, "simple_http_nowhere_redirect", true);
        upgradeToSecure = true;
      } else {
        newuristr = newuristr.replace(/^http:/, "https:");
      }
    }
    if (
      newuristr &&
      (
        newuristr.substring(0, 5) === "http:" ||
        newuristr.substring(0, 4) === "ftp:"
      )
    ) {
      // Abort early if we're about to redirect to HTTP or FTP in HTTP Nowhere mode
      return {redirectUrl: newCancelUrl(newuristr)};
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
    return redirectOnCancel(shouldCancel, details.url);
  }
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
    let count = browserSession.getRequest(details.requestId, "redirect_count", 0);
    if (count) {
      browserSession.putRequest(details.requestId, "redirect_count", count + 1);
      util.log(util.DBUG, "Got redirect id " + details.requestId + ": "+count);
    } else {
      browserSession.putRequest(details.requestId, "redirect_count", 1);
    }
  }
}

/**
 * handle webrequest.onCompleted, cleanup redirectCounter
 * @param details details for the chrome.webRequest (see chrome doc)
 */
function onCompleted(details) {
  browserSession.deleteRequest(details.requestId);
}

/**
 * handle webrequest.onErrorOccurred, cleanup redirectCounter
 * @param details details for the chrome.webRequest (see chrome doc)
 */
function onErrorOccurred(details) {
  if (httpNowhereOn &&
    details.type == "main_frame" &&
    browserSession.getRequest(details.requestId, "simple_http_nowhere_redirect", false) &&
    // Enumerate errors that are likely due to HTTPS misconfigurations
    ssl_codes.error_list.some(message => details.error.includes(message))
  ) {
    let url = new URL(details.url);
    if (url.protocol == "https:") {
      url.protocol = "http:";
    }
    chrome.tabs.update(details.tabId, {url: newCancelUrl(url.toString())});
  }

  browserSession.deleteRequest(details.requestId);
}

/**
 * handle webrequest.onHeadersReceived, insert upgrade-insecure-requests directive and
 * rewrite access-control-allow-origin if presented in HTTP Nowhere mode
 * @param details details for the chrome.webRequest (see chrome doc)
 */
function onHeadersReceived(details) {
  if (isExtensionEnabled && httpNowhereOn) {
    // Do not upgrade the .onion requests in EASE mode,
    // See https://github.com/EFForg/https-everywhere/pull/14600#discussion_r168072480
    const uri = new URL(details.url);
    const hostname = util.getNormalisedHostname(uri.hostname);
    if (hostname.slice(-6) == '.onion') {
      return {};
    }

    // Do not upgrade resources if the first-party domain disbled EASE mode
    // This is needed for HTTPS sites serve mixed content and is broken
    if (isExtensionDisabledOnSite(browserSession.getTab(details.tabId, 'first_party_host', null))) {
      return {};
    }

    let responseHeadersChanged = false;
    let cspHeaderFound = false;

    for (const idx in details.responseHeaders) {
      if (details.responseHeaders[idx].name.match(/Content-Security-Policy/i)) {
        // Existing CSP headers found
        cspHeaderFound = true;
        const value = details.responseHeaders[idx].value;

        // Prepend if no upgrade-insecure-requests directive exists
        if (!value.match(/upgrade-insecure-requests/i)) {
          details.responseHeaders[idx].value = "upgrade-insecure-requests; " + value;
          responseHeadersChanged = true;
        }
      }

      if (details.responseHeaders[idx].name.match(/Access-Control-Allow-Origin/i)) {
        // Existing access-control-allow-origin header found
        const value = details.responseHeaders[idx].value;

        // If HTTP protocol is used, change it to HTTPS
        if (value.match(/http:/)) {
          details.responseHeaders[idx].value = value.replace(/http:/g, "https:");
          responseHeadersChanged = true;
        }
      }
    }

    if (!cspHeaderFound) {
      // CSP headers not found
      const upgradeInsecureRequests = {
        name: 'Content-Security-Policy',
        value: 'upgrade-insecure-requests'
      };
      details.responseHeaders.push(upgradeInsecureRequests);
      responseHeadersChanged = true;
    }

    if (responseHeadersChanged) {
      return {responseHeaders: details.responseHeaders};
    }
  }
  return {};
}

// Registers the handler for requests
// See: https://github.com/EFForg/https-everywhere/issues/10039
chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ["*://*/*", "ftp://*/*"]}, ["blocking"]);

// Try to catch redirect loops on URLs we've redirected to HTTPS.
chrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, {urls: ["https://*/*"]});

// Cleanup redirectCounter if necessary
chrome.webRequest.onCompleted.addListener(onCompleted, {urls: ["*://*/*"]});

// Cleanup redirectCounter if necessary
chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, {urls: ["*://*/*"]});

// Insert upgrade-insecure-requests directive in httpNowhere mode
chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {urls: ["https://*/*"]}, ["blocking", "responseHeaders"]);

// Listen for cookies set/updated and secure them if applicable. This function is async/nonblocking.
chrome.cookies.onChanged.addListener(onCookieChanged);

// This is necessary for communication with the popup in Firefox Private
// Browsing Mode, see https://bugzilla.mozilla.org/show_bug.cgi?id=1329304
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {

  function get_update_channels_generic(update_channels) {
    let last_updated_promises = [];
    for(let update_channel of update_channels) {
      last_updated_promises.push(new Promise(resolve => {
        store.local.get({['uc-timestamp: ' + update_channel.name]: 0}, item => {
          resolve([update_channel.name, item['uc-timestamp: ' + update_channel.name]]);
        });
      }));
    }
    Promise.all(last_updated_promises).then(results => {
      const last_updated = results.reduce((obj, item) => {
        obj[item[0]] = item[1];
        return obj;
      }, {});
      sendResponse({update_channels, last_updated});
    });
  }

  function storeDisabledList(message) {

    const disabledListArray = Array.from(disabledList);
    const httpOnceListArray = Array.from(httpOnceList);

    if (message === 'once') {
      store.set({httpOnceList: httpOnceListArray}, () => {
        sendResponse(true);
      });
    } else {
      store.set({disabledList: disabledListArray}, () => {
        sendResponse(true);
      });
    }

    return true;
  }

  const responses = {
    get_option: () => {
      store.get(message.object, sendResponse);
      return true;
    },
    set_option: () => {
      store.set(message.object, item => {
        if (sendResponse) {
          sendResponse(item);
        }
      });
    },
    delete_from_ruleset_cache: () => {
      all_rules.ruleCache.delete(message.object);
    },
    get_applied_rulesets: () => {
      sendResponse(browserSession.getTabAppliedRulesets(message.object));
      return true;
    },
    set_ruleset_active_status: () => {
      let rulesets = browserSession.getTabAppliedRulesets(message.object.tab_id);

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
    },
    reset_to_defaults: () => {
      // restore the 'default states' of the rulesets
      store.set_promise('ruleActiveStates', {}).then(() => {
        // clear the caches such that it becomes stateless
        destroy_caches();
        // re-activate all rules according to the new states
        initializeAllRules();
        // reload tabs when operations completed
        chrome.tabs.reload();
      });
    },
    get_user_rules: () => {
      store.get_promise(all_rules.USER_RULE_KEY, []).then(userRules => sendResponse(userRules));
      return true;
    },
    add_new_rule: () => {
      all_rules.addNewRuleAndStore(message.object).then(() => {
        sendResponse(true);
      });
      return true;
    },
    remove_rule: () => {
      all_rules.removeRuleAndStore(message.object.ruleset, message.object.src)
        .then(() => {
          /**
           * FIXME: initializeAllRules is needed for calls from the option pages.
           * Since message.object is not of type Ruleset, rules.removeUserRule
           * is not usable...
           */
          if (message.object.src === 'options') {
            return initializeAllRules();
          }
        })
        .then(() => {
          if (sendResponse !== null) {
            sendResponse(true);
          }
        });
      return true;
    },
    get_update_channel_timestamps: () => {
      update.getUpdateChannelTimestamps().then(timestamps => sendResponse(timestamps));
      return true;
    },
    get_pinned_update_channels: () => {
      get_update_channels_generic(update_channels);
      return true;
    },
    get_stored_update_channels: () => {
      store.get({update_channels: []}, item => {
        get_update_channels_generic(item.update_channels);
      });
      return true;
    },
    create_update_channel: () => {

      store.get({update_channels: []}, item => {

        const update_channel_names = update_channels.concat(item.update_channels).reduce((obj, item) => {
          obj.add(item.name);
          return obj;
        }, new Set());

        if(update_channel_names.has(message.object)) {
          return sendResponse(false);
        }

        item.update_channels.push({
          name: message.object,
          jwk: {},
          update_path_prefix: '',
          scope: ''
        });

        store.set({update_channels: item.update_channels}, () => {
          sendResponse(true);
        });

      });
      return true;
    },
    delete_update_channel: () => {
      store.get({update_channels: []}, item => {
        store.set({update_channels: item.update_channels.filter(update_channel => {
          return (update_channel.name != message.object);
        })}, () => {
          store.local.remove([
            'uc-timestamp: ' + message.object,
            'uc-stored-timestamp: ' + message.object,
            'rulesets: ' + message.object,
            'bloom: ' + message.object,
            'bloom_bitmap_bits: ' + message.object,
            'bloom_k_num: ' + message.object,
            'bloom_sip_keys_0_0: ' + message.object,
            'bloom_sip_keys_0_1: ' + message.object,
            'bloom_sip_keys_1_0: ' + message.object,
            'bloom_sip_keys_1_1: ' + message.object,
          ], () => {
            initializeAllRules();
            sendResponse(true);
          });
        });
      });
      return true;
    },
    update_update_channel: () => {
      store.get({update_channels: []}, item => {
        let scope_changed = false;
        item.update_channels = item.update_channels.map(update_channel => {
          if(update_channel.name == message.object.name) {
            if(update_channel.scope != message.object.scope) {
              scope_changed = true;
            }
            update_channel = message.object;
          }
          return update_channel;
        });

        // Ensure that we check for new rulesets from the update channel immediately.
        // If the scope has changed, make sure that the rulesets are re-initialized.
        update.removeStorageListener();
        store.set({update_channels: item.update_channels}, () => {
          update.loadUpdateChannelsKeys().then(() => {
            update.resetTimer();
            if(scope_changed) {
              initializeAllRules();
            }
            sendResponse(true);
          });
          update.addStorageListener();
        });
      });
      return true;
    },
    get_simple_rules_ending_with: () => {
      return sendResponse(all_rules.getSimpleRulesEndingWith(message.object));
    },
    get_last_checked: () => {
      store.local.get({'last-checked': false}, item => {
        sendResponse(item['last-checked']);
      });
      return true;
    },
    disable_on_site_once: () => {
      httpOnceList.add(message.object);
      return storeDisabledList('once');
    },
    disable_on_site: () => {
      const host = util.getNormalisedHostname(message.object);
      // always validate hostname before adding it to the disabled list
      if (util.isValidHostname(host)) {
        disabledList.add(host);
        return storeDisabledList('disable');
      }
      return sendResponse(false);
    },
    enable_on_site: () => {
      disabledList.delete(util.getNormalisedHostname(message.object));
      return storeDisabledList('enable');
    },
    check_if_site_disabled: () => {
      return sendResponse(isExtensionDisabledOnSite(util.getNormalisedHostname(message.object)));
    },
    is_firefox: () => {
      if(typeof(browser) != "undefined") {
        browser.runtime.getBrowserInfo().then(function(info) {
          if (info.name == "Firefox") {
            sendResponse(true);
          } else {
            sendResponse(false);
          }
        });
      } else {
        sendResponse(false);
      }
      return true;
    }
  };
  if (message.type in responses) {
    return responses[message.type]();
  }
});

/**
 * Clear any cache/ blacklist we have.
 */
function destroy_caches() {
  util.log(util.DBUG, "Destroying caches.");
  all_rules.cookieHostCache.clear();
  all_rules.ruleCache.clear();
  rules.settings.domainBlacklist.clear();
  urlBlacklist.clear();
  httpOnceList.clear();
}

Object.assign(exports, {
  all_rules,
  blooms,
  urlBlacklist
});

})(typeof exports == 'undefined' ? require.scopes.background = {} : exports);
