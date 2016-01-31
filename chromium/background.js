"use strict";
/**
 * Fetch and parse XML to be loaded as RuleSets.
 *
 * @param url: a relative URL to local XML
 */
function loadExtensionFile(url, returnType) {
  var xhr = new XMLHttpRequest();
  // Use blocking XHR to ensure everything is loaded by the time
  // we return.
  xhr.open("GET", chrome.extension.getURL(url), false);
  xhr.send(null);
  // Get file contents
  if (xhr.readyState != 4) {
    return;
  }
  if (returnType === 'xml') {
    return xhr.responseXML;
  }
  return xhr.responseText;
}


// Rules are loaded here
var all_rules = new RuleSets(localStorage);
all_rules.addFromXml(loadExtensionFile('rules/default.rulesets', 'xml'));


var USER_RULE_KEY = 'userRules';
// Records which tabId's are active in the HTTPS Switch Planner (see
// devtools-panel.js).
var switchPlannerEnabledFor = {};
// Detailed information recorded when the HTTPS Switch Planner is active.
// Structure is:
//   switchPlannerInfo[tabId]["rw"/"nrw"][resource_host][active_content][url];
// rw / nrw stand for "rewritten" versus "not rewritten"
var switchPlannerInfo = {};

// Is HTTPSe enabled, or has it been manually disabled by the user?
var isExtensionEnabled = true;
// The setBadgeText API has an abandoned bug: https://crbug.com/170413
chrome.browserAction.setBadgeText({ text: "" });

// Load prefs about whether http nowhere is on. Structure is:
//  { httpNowhere: true/false }
var httpNowhereOn = false;
chrome.storage.sync.get({httpNowhere: false}, function(item) {
  httpNowhereOn = item.httpNowhere;
  setIconColor();
});
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName === 'sync') {
    for (var key in changes) {
      if (key === 'httpNowhere') {
        httpNowhereOn = changes[key].newValue;
        setIconColor();
      }
    }
  }
});

/**
* Load stored user rules
 **/
var getStoredUserRules = function() {
  var oldUserRuleString = localStorage.getItem(USER_RULE_KEY);
  var oldUserRules = [];
  if (oldUserRuleString) {
    oldUserRules = JSON.parse(oldUserRuleString);
  }
  return oldUserRules;
};
var wr = chrome.webRequest;

/**
 * Load all stored user rules
 */
var loadStoredUserRules = function() {
  var rules = getStoredUserRules();
  var i;
  for (i = 0; i < rules.length; ++i) {
    all_rules.addUserRule(rules[i]);
  }
  log('INFO', 'loaded ' + i + ' stored user rules');
};

loadStoredUserRules();

/**
 * Set the icon color correctly
 * Depending on http-nowhere it should be red/default
 */
var setIconColor = function() {
  var newIconPath = httpNowhereOn ? './icon38-red.png' : './icon38.png';
  chrome.browserAction.setIcon({
    path: newIconPath
  });
};

/*
for (var v in localStorage) {
  log(DBUG, "localStorage["+v+"]: "+localStorage[v]);
}

var rs = all_rules.potentiallyApplicableRulesets("www.google.com");
for (r in rs) {
  log(DBUG, rs[r].name +": "+ rs[r].active);
  log(DBUG, rs[r].name +": "+ rs[r].default_state);
}
*/

/**
 * Adds a new user rule
 * @param params: params defining the rule
 * @param cb: Callback to call after success/fail
 * */
var addNewRule = function(params, cb) {
  if (all_rules.addUserRule(params)) {
    // If we successfully added the user rule, save it in local 
    // storage so it's automatically applied when the extension is 
    // reloaded.
    var oldUserRules = getStoredUserRules();
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
 * Adds a listener for removed tabs
 * */
function AppliedRulesets() {
  this.active_tab_rules = {};

  var that = this;
  chrome.tabs.onRemoved.addListener(function(tabId, info) {
    that.removeTab(tabId);
  });
}

AppliedRulesets.prototype = {
  addRulesetToTab: function(tabId, ruleset) {
    if (tabId in this.active_tab_rules) {
      this.active_tab_rules[tabId][ruleset.name] = ruleset;
    } else {
      this.active_tab_rules[tabId] = {};
      this.active_tab_rules[tabId][ruleset.name] = ruleset;
    }
  },

  getRulesets: function(tabId) {
    if (tabId in this.active_tab_rules) {
      return this.active_tab_rules[tabId];
    }
    return null;
  },

  removeTab: function(tabId) {
    delete this.active_tab_rules[tabId];
  }
};

// FIXME: change this name
var activeRulesets = new AppliedRulesets();

var urlBlacklist = new Set();
var domainBlacklist = new Set();

// redirect counter workaround
// TODO: Remove this code if they ever give us a real counter
var redirectCounter = {};

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

  var uri = document.createElement('a');
  uri.href = details.url;

  // Should the request be canceled?
  var shouldCancel = (httpNowhereOn && uri.protocol === 'http:');

  // Normalise hosts such as "www.example.com."
  var canonical_host = uri.hostname;
  if (canonical_host.charAt(canonical_host.length - 1) == ".") {
    while (canonical_host.charAt(canonical_host.length - 1) == ".")
      canonical_host = canonical_host.slice(0,-1);
    uri.hostname = canonical_host;
  }

  // If there is a username / password, put them aside during the ruleset
  // analysis process
  var using_credentials_in_url = false;
  if (uri.password || uri.username) {
      using_credentials_in_url = true;
      var tmp_user = uri.username;
      var tmp_pass = uri.password;
      uri.username = null;
      uri.password = null;
  }

  var canonical_url = uri.href;
  if (details.url != canonical_url && !using_credentials_in_url) {
    log(INFO, "Original url " + details.url + 
        " changed before processing to " + canonical_url);
  }
  if (urlBlacklist.has(canonical_url)) {
    return {cancel: shouldCancel};
  }

  if (details.type == "main_frame") {
    activeRulesets.removeTab(details.tabId);
  }

  var potentiallyApplicable = all_rules.potentiallyApplicableRulesets(uri.hostname);
  // If no rulesets could apply, let's get out of here!
  if (potentiallyApplicable.size === 0) { return {cancel: shouldCancel}; }

  if (redirectCounter[details.requestId] >= 8) {
    log(NOTE, "Redirect counter hit for " + canonical_url);
    urlBlacklist.add(canonical_url);
    var hostname = uri.hostname;
    domainBlacklist.add(hostname);
    log(WARN, "Domain blacklisted " + hostname);
    return {cancel: shouldCancel};
  }

  var newuristr = null;

  for (let ruleset of potentiallyApplicable) {
    activeRulesets.addRulesetToTab(details.tabId, ruleset);
    if (ruleset.active && !newuristr) {
      newuristr = ruleset.apply(canonical_url);
    }
  }

  if (newuristr && using_credentials_in_url) {
    // re-insert userpass info which was stripped temporarily
    var uri_with_credentials = document.createElement('a');
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
var activeTypes = { stylesheet: 1, script: 1, object: 1, other: 1};

// We consider sub_frame to be passive even though it can contain JS or flash.
// This is because code running in the sub_frame cannot access the main frame's
// content, by same-origin policy. This is true even if the sub_frame is on the
// same domain but different protocol - i.e. HTTP while the parent is HTTPS -
// because same-origin policy includes the protocol. This also mimics Chrome's
// UI treatment of insecure subframes.
var passiveTypes = { main_frame: 1, sub_frame: 1, image: 1, xmlhttprequest: 1};

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
  var rw = "rw";
  if (rewritten_url == null)
    rw = "nrw";

  var active_content = 0;
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
* Format the switch planner output for presentation to a user.
* */
function switchPlannerSmallHtmlSection(tab_id, rewritten) {
  var asset_host_list = sortSwitchPlanner(tab_id, rewritten);
  if (asset_host_list.length == 0) {
    return "<b>none</b>";
  }

  var output = "";
  for (var i = asset_host_list.length - 1; i >= 0; i--) {
    var host = asset_host_list[i][3];
    var activeCount = asset_host_list[i][1];
    var passiveCount = asset_host_list[i][2];

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
  if (typeof map == 'undefined') return "";
  var output = "";
  for (var key in map) {
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
  var asset_host_list = sortSwitchPlanner(tab_id, rewritten);
  var output = "";

  for (var i = asset_host_list.length - 1; i >= 0; i--) {
    var host = asset_host_list[i][3];
    var activeCount = asset_host_list[i][1];
    var passiveCount = asset_host_list[i][2];

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
      var cookie = {name:changeInfo.cookie.name,
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
    var prefix = details.redirectUrl.substring(0, 5);
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
// We listen to all HTTP hosts, because RequestFilter can't handle tons of url restrictions.
wr.onBeforeRequest.addListener(onBeforeRequest, {urls: ["http://*/*"]}, ["blocking"]);

// TODO: Listen only to the tiny subset of HTTPS hosts that we rewrite/downgrade.
var httpsUrlsWeListenTo = ["https://*/*"];
// See: https://developer.chrome.com/extensions/match_patterns
wr.onBeforeRequest.addListener(onBeforeRequest, {urls: httpsUrlsWeListenTo}, ["blocking"]);


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
chrome.runtime.onConnect.addListener(function (port) {
  if (port.name == "devtools-page") {
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
      var tabId = message.tabId;

      var disableOnCloseCallback = function(port) {
        log(DBUG, "Devtools window for tab " + tabId + " closed, clearing data.");
        disableSwitchPlannerFor(tabId);
      };

      if (message.type === "enable") {
        enableSwitchPlannerFor(tabId);
        port.onDisconnect.addListener(disableOnCloseCallback);
      } else if (message.type === "disable") {
        disableSwitchPlannerFor(tabId);
      } else if (message.type === "getSmallHtml") {
        sendResponse({html: switchPlannerSmallHtml(tabId)});
      }
    });
  }
});
