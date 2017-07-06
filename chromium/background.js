"use strict";
/**
 * Fetch and parse XML to be loaded as RuleSets.
 *
 * @param url: a relative URL to local XML
 */
function loadExtensionFile(url, returnType) {
  const xhr = new XMLHttpRequest();
  // Use blocking XHR to ensure everything is loaded by the time
  // we return.
  xhr.open("GET", chrome.extension.getURL(url), false);
  xhr.send(null);
  // Get file contents
  if (xhr.readyState !== 4) {
    return;
  }
  if (returnType === 'xml') {
    return xhr.responseXML;
  }
  return xhr.responseText;
}


// Rules are loaded here
const all_rules = new RuleSets(localStorage);

// Allow users to enable `platform="mixedcontent"` rulesets
let enableMixedRulesets = false;
storage.get({enableMixedRulesets: false}, item => {
  enableMixedRulesets = item.enableMixedRulesets;
  all_rules.addFromXml(loadExtensionFile('rules/default.rulesets', 'xml'));
});

const USER_RULE_KEY = 'userRules';
// Records which tabId's are active in the HTTPS Switch Planner (see
// devtools-panel.js).
const switchPlannerEnabledFor = {};
// Detailed information recorded when the HTTPS Switch Planner is active.
// Structure is:
//   switchPlannerInfo[tabId]["rw"/"nrw"][resource_host][active_content][url];
// rw / nrw stand for "rewritten" versus "not rewritten"
const switchPlannerInfo = {};

// Is HTTPSe enabled, or has it been manually disabled by the user?
let isExtensionEnabled = true;

// Load prefs about whether http nowhere is on. Structure is:
//  { httpNowhere: true/false }
let httpNowhereOn = false;
storage.get({httpNowhere: false}, item => {
  httpNowhereOn = item.httpNowhere;
  updateState();
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' || areaName === 'local') {
    for (const key in changes) {
      if (key === 'httpNowhere') {
        httpNowhereOn = changes[key].newValue;
        updateState();
      }
    }
  }
});
chrome.tabs.onActivated.addListener(() => {
  updateState();
});
chrome.windows.onFocusChanged.addListener(() => {
  updateState();
});
chrome.webNavigation.onCompleted.addListener(() => {
  updateState();
});

/**
* Load stored user rules
 **/
function getStoredUserRules() {
  const oldUserRuleString = localStorage.getItem(USER_RULE_KEY);
  let oldUserRules = [];
  if (oldUserRuleString) {
    oldUserRules = JSON.parse(oldUserRuleString);
  }
  return oldUserRules;
};
const wr = chrome.webRequest;

/**
 * Load all stored user rules
 */
function loadStoredUserRules() {
  const rules = getStoredUserRules();
  for (const rule of rules) {
    all_rules.addUserRule(rule);
  }
  log('INFO', 'loaded ' + rules.length + ' stored user rules');
};

loadStoredUserRules();

/**
 * Set the icon color correctly
 * inactive: extension is enabled, but no rules were triggered on this page.
 * blocking: extension is in "block all HTTP requests" mode.
 * active: extension is enabled and rewrote URLs on this page.
 * disabled: extension is disabled from the popup menu.
 */
function updateState() {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (!tabs || tabs.length === 0) {
      return;
    }
    const applied = activeRulesets.getRulesets(tabs[0].id)
    let iconState = "inactive";
    if (!isExtensionEnabled) {
      iconState = "disabled";
    } else if (httpNowhereOn) {
      iconState = "blocking";
    } else if (applied) {
      iconState = "active";
    }
    chrome.browserAction.setIcon({
      path: {
        "38": "icons/icon-" + iconState + "-38.png"
      }
    });
    chrome.browserAction.setTitle({
      title: "HTTPS Everywhere (" + iconState + ")"
    });
  });
}

/**
 * Adds a new user rule
 * @param params: params defining the rule
 * @param cb: Callback to call after success/fail
 * */
function addNewRule(params, cb) {
  if (all_rules.addUserRule(params)) {
    // If we successfully added the user rule, save it in local 
    // storage so it's automatically applied when the extension is 
    // reloaded.
    const oldUserRules = getStoredUserRules();
    // TODO: there's a race condition here, if this code is ever executed from multiple 
    // client windows in different event loops.
    oldUserRules.push(params);
    // TODO: can we exceed the max size for storage?
    localStorage.setItem(USER_RULE_KEY, JSON.stringify(oldUserRules));
    cb(true);
  } else {
    cb(false);
  }
};

/**
 * Removes a user rule
 * @param ruleset: the ruleset to remove
 * */
function removeRule(ruleset) {
  if (all_rules.removeUserRule(ruleset)) {
    // If we successfully removed the user rule, remove it in local storage too
    const oldUserRules = getStoredUserRules();
    for (const i = 0; i < oldUserRules.length; i++) {
      if (oldUserRules[i].host === ruleset.name &&
          oldUserRules[i].redirectTo === ruleset.rules[0].to &&
          String(RegExp(oldUserRules[i].urlMatcher)) === String(ruleset.rules[0].from_c)) {
        oldUserRules.splice(i, 1);
        break;
      }
    }
    localStorage.setItem(USER_RULE_KEY, JSON.stringify(oldUserRules));
  }
}

/**
 * Adds a listener for removed tabs
 * */
function AppliedRulesets() {
  this.active_tab_rules = {};

  const that = this;
  chrome.tabs.onRemoved.addListener((tabId, info) => {
    that.removeTab(tabId);
  });
}

AppliedRulesets.prototype = {
  addRulesetToTab: (tabId, ruleset) => {
    if (tabId in this.active_tab_rules) {
      this.active_tab_rules[tabId][ruleset.name] = ruleset;
    } else {
      this.active_tab_rules[tabId] = {};
      this.active_tab_rules[tabId][ruleset.name] = ruleset;
    }
  },

  getRulesets: tabId => {
    if (tabId in this.active_tab_rules) {
      return this.active_tab_rules[tabId];
    }
    return null;
  },

  removeTab: tabId => {
    delete this.active_tab_rules[tabId];
  }
};

// FIXME: change this name
const activeRulesets = new AppliedRulesets();

const urlBlacklist = new Set();
const domainBlacklist = new Set();

// redirect counter workaround
// TODO: Remove this code if they ever give us a real counter
const redirectCounter = {};

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

  const uri = document.createElement('a');
  uri.href = details.url;

  // Should the request be canceled?
  const shouldCancel = (
    httpNowhereOn &&
    uri.protocol === 'http:' &&
    !/\.onion$/.test(uri.hostname) &&
    !/^localhost$/.test(uri.hostname) &&
    !/^127(\.[0-9]{1,3}){3}$/.test(uri.hostname) &&
    !/^0\.0\.0\.0$/.test(uri.hostname)
  );

  // Normalise hosts such as "www.example.com."
  let canonical_host = uri.hostname;
  if (canonical_host.charAt(canonical_host.length - 1) === ".") {
    while (canonical_host.charAt(canonical_host.length - 1) === ".")
      canonical_host = canonical_host.slice(0,-1);
    uri.hostname = canonical_host;
  }

  // If there is a username / password, put them aside during the ruleset
  // analysis process

  let using_credentials_in_url = false;
  let tmp_user, tmp_pass;

  if (uri.password || uri.username) {
      using_credentials_in_url = true;
      tmp_user = uri.username;
      tmp_pass = uri.password;
      uri.username = null;
      uri.password = null;
  }

  const canonical_url = uri.href;
  if (details.url !== canonical_url && !using_credentials_in_url) {
    log(INFO, "Original url " + details.url + 
        " changed before processing to " + canonical_url);
  }
  if (urlBlacklist.has(canonical_url)) {
    return {cancel: shouldCancel};
  }

  if (details.type === "main_frame") {
    activeRulesets.removeTab(details.tabId);
  }

  const potentiallyApplicable = all_rules.potentiallyApplicableRulesets(uri.hostname);

  if (redirectCounter[details.requestId] >= 8) {
    log(NOTE, "Redirect counter hit for " + canonical_url);
    urlBlacklist.add(canonical_url);
    const hostname = uri.hostname;
    domainBlacklist.add(hostname);
    log(WARN, "Domain blacklisted " + hostname);
    return {cancel: shouldCancel};
  }

  let newuristr = null;

  for (const ruleset of potentiallyApplicable) {
    activeRulesets.addRulesetToTab(details.tabId, ruleset);
    if (ruleset.active && !newuristr) {
      newuristr = ruleset.apply(canonical_url);
    }
  }

  if (newuristr && using_credentials_in_url) {
    // re-insert userpass info which was stripped temporarily
    const uri_with_credentials = document.createElement('a');
    uri_with_credentials.href = newuristr;
    uri_with_credentials.username = tmp_user;
    uri_with_credentials.password = tmp_pass;
    newuristr = uri_with_credentials.href;
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
      if (!newuristr) {
        return {redirectUrl: canonical_url.replace(/^http:/, "https:")};
      } else {
        return {redirectUrl: newuristr.replace(/^http:/, "https:")};
      }
    }
    if (newuristr && newuristr.substring(0, 5) === "http:") {
      // Abort early if we're about to redirect to HTTP in HTTP Nowhere mode
      return {cancel: true};
    }
  }

  if (newuristr) {
    return {redirectUrl: newuristr};
  } else {
    return {cancel: shouldCancel};
  }
}


// Map of which values for the `type' enum denote active vs passive content.
// https://developer.chrome.com/extensions/webRequest.html#event-onBeforeRequest
const activeTypes = { stylesheet: 1, script: 1, object: 1, other: 1};

// We consider sub_frame to be passive even though it can contain JS or flash.
// This is because code running in the sub_frame cannot access the main frame's
// content, by same-origin policy. This is true even if the sub_frame is on the
// same domain but different protocol - i.e. HTTP while the parent is HTTPS -
// because same-origin policy includes the protocol. This also mimics Chrome's
// UI treatment of insecure subframes.
const passiveTypes = { main_frame: 1, sub_frame: 1, image: 1, xmlhttprequest: 1};

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
  let rw = "rw";
  if (rewritten_url === null)
    rw = "nrw";

  let active_content = 0;
  if (activeTypes[type]) {
    active_content = 1;
  } else if (passiveTypes[type]) {
    active_content = 0;
  } else {
    log(WARN, "Unknown type from onBeforeRequest details: `" + type + "', assuming active");
    active_content = 1;
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
  if (typeof obj === 'undefined') return 0;
  let size = 0;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) size++;
  }
  return size;
}

/**
 * Make an array of asset hosts by score so we can sort them,
 * presenting the most important ones first.
 * */
function sortSwitchPlanner(tab_id, rewritten) {
  const asset_host_list = [];
  if (typeof switchPlannerInfo[tab_id] === 'undefined' ||
      typeof switchPlannerInfo[tab_id][rewritten] === 'undefined') {
    return [];
  }
  const tabInfo = switchPlannerInfo[tab_id][rewritten];
  for (const asset_host in tabInfo) {
    const ah = tabInfo[asset_host];
    const activeCount = objSize(ah[1]);
    const passiveCount = objSize(ah[0]);
    const score = activeCount * 100 + passiveCount;
    asset_host_list.push([score, activeCount, passiveCount, asset_host]);
  }
  asset_host_list.sort((a, b) => a[0]-b[0]);
  return asset_host_list;
}

/**
* Format the switch planner output for presentation to a user.
* */
function switchPlannerSmallHtmlSection(tab_id, rewritten) {
  const asset_host_list = sortSwitchPlanner(tab_id, rewritten);
  if (asset_host_list.length === 0) {
    return "<b>none</b>";
  }

  let output = "";
  for (const asset_host of asset_host_list) {
    const host = asset_host[3];
    const activeCount = asset_host[1];
    const passiveCount = asset_host[2];

    output += "<b>" + host + "</b>: ";
    if (activeCount > 0) {
      output += activeCount + " active";
      if (passiveCount > 0)
        output += ", ";
    }
    if (passiveCount > 0) {
      output += passiveCount + " passive";
    }
    output += "<br/>";
  }
  return output;
}

/**
 * Create switch planner sections
 * */
function switchPlannerRenderSections(tab_id, f) {
  return "Unrewritten HTTP resources loaded from this tab (enable HTTPS on " +
         "these domains and add them to HTTPS Everywhere):<br/>" +
         f(tab_id, "nrw") +
         "<br/>Resources rewritten successfully from this tab (update these " +
         "in your source code):<br/>" +
         f(tab_id, "rw");
}

/**
 * Generate the small switch planner html content
 * */
function switchPlannerSmallHtml(tab_id) {
  return switchPlannerRenderSections(tab_id, switchPlannerSmallHtmlSection);
}

/**
 * Generate a HTML link from urls in map
 * map: the map containing the urls
 * */
function linksFromKeys(map) {
  if (typeof map === 'undefined') return "";
  let output = "";
  for (const key in map) {
    if (map.hasOwnProperty(key)) {
      output += "<a href='" + key + "'>" + key + "</a><br/>";
    }
  }
  return output;
}

/**
 * Generate the detailed html fot the switch planner
 * */
function switchPlannerDetailsHtml(tab_id) {
  return switchPlannerRenderSections(tab_id, switchPlannerDetailsHtmlSection);
}

/**
 * Generate the detailed html fot the switch planner, by section
 * */
function switchPlannerDetailsHtmlSection(tab_id, rewritten) {
  const asset_host_list = sortSwitchPlanner(tab_id, rewritten);
  let output = "";

  for (const asset_host of asset_host_list) {
    const host = asset_host[3];
    const activeCount = asset_host[1];
    const passiveCount = asset_host[2];

    output += "<b>" + host + "</b>: ";
    if (activeCount > 0) {
      output += activeCount + " active<br/>";
      output += linksFromKeys(switchPlannerInfo[tab_id][rewritten][host][1]);
    }
    if (passiveCount > 0) {
      output += "<br/>" + passiveCount + " passive<br/>";
      output += linksFromKeys(switchPlannerInfo[tab_id][rewritten][host][0]);
    }
    output += "<br/>";
  }
  return output;
}

/**
 * monitor cookie changes. Automatically convert them to secure cookies
 * @param changeInfo Cookie changed info, see Chrome doc
 * */
function onCookieChanged(changeInfo) {
  if (!changeInfo.removed && !changeInfo.cookie.secure && isExtensionEnabled) {
    if (all_rules.shouldSecureCookie(changeInfo.cookie)) {
      const cookie = {name:changeInfo.cookie.name,
                      value:changeInfo.cookie.value,
                      path:changeInfo.cookie.path,
                      httpOnly:changeInfo.cookie.httpOnly,
                      expirationDate:changeInfo.cookie.expirationDate,
                      storeId:changeInfo.cookie.storeId,
                      secure: true};

      // Host-only cookies don't set the domain field.
      if (!changeInfo.cookie.hostOnly) {
          cookie.domain = changeInfo.cookie.domain;
      }

      // The cookie API is magical -- we must recreate the URL from the domain and path.
      if (changeInfo.cookie.domain[0] == ".") {
          cookie.url = "https://www" + changeInfo.cookie.domain + cookie.path;
      } else {
          cookie.url = "https://" + changeInfo.cookie.domain + cookie.path;
      }
      // We get repeated events for some cookies because sites change their
      // value repeatedly and remove the "secure" flag.
      log(DBUG,
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
    const prefix = details.redirectUrl.substring(0, 5);
    if (prefix === "http:" || prefix === "https") {
        if (details.requestId in redirectCounter) {
            redirectCounter[details.requestId] += 1;
            log(DBUG, "Got redirect id "+details.requestId+
                ": "+redirectCounter[details.requestId]);
        } else {
            redirectCounter[details.requestId] = 1;
        }
    }
}

// Registers the handler for requests
// See: https://github.com/EFForg/https-everywhere/issues/10039
wr.onBeforeRequest.addListener(onBeforeRequest, {urls: ["<all_urls>"]}, ["blocking"]);


// Try to catch redirect loops on URLs we've redirected to HTTPS.
wr.onBeforeRedirect.addListener(onBeforeRedirect, {urls: ["https://*/*"]});


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
chrome.runtime.onConnect.addListener(port => {
  if (port.name === "devtools-page") {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const tabId = message.tabId;

      if (message.type === "enable") {
        enableSwitchPlannerFor(tabId);
        port.onDisconnect.addListener(port => {
          log(DBUG, "Devtools window for tab " + tabId + " closed, clearing data.");
          disableSwitchPlannerFor(tabId);
        });
      } else if (message.type === "disable") {
        disableSwitchPlannerFor(tabId);
      } else if (message.type === "getSmallHtml") {
        sendResponse({html: switchPlannerSmallHtml(tabId)});
      }
    });
  }
});
