var switchPlannerMode = true;
var switchPlanner = {};
  console.log("XXX TESTING XXX");

var all_rules = new RuleSets();
var wr = chrome.webRequest;

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

function displayPageAction(tabId) {
  // Right now, the call to chrome.tabs.get creates
  // a console error for a missing tab, even in a try/catch
  // block. As it still provides a good test of whether a tab
  // exists (if it does not then 'tab' in the callback is undefined)
  // Reading forums on chrome extensions, it seems the only way
  // to avoid a console error is to loop through all windows
  // and explicitly check for the tabid in question. This seems
  // expensive and not necessary so we are living with console errors
  // of the form: "Error during tabs.get: No tab with id: 370"

  if (tabId != -1 && this.activeRulesets.getRulesets(tabId)) {
    chrome.tabs.get(tabId, function(tab) {
      if(typeof(tab) == "undefined") {
        log(DBUG, "Not a real tab. Skipping showing pageAction.");
      }
      else {
        chrome.pageAction.show(tabId);
      }
    });
  }
}

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
    if (tabId in this.active_tab_rules)
      return this.active_tab_rules[tabId];
    else
      return null;
  },

  removeTab: function(tabId) {
    delete this.active_tab_rules[tabId];
  }
};

// FIXME: change this name
var activeRulesets = new AppliedRulesets();

var urlBlacklist = {};
var domainBlacklist = {};

// redirect counter workaround
// TODO: Remove this code if they ever give us a real counter
var redirectCounter = {};

function onBeforeRequest(details) {
  // get URL into canonical format
  // todo: check that this is enough
  var uri = new URI(details.url);

  // Normalise hosts such as "www.example.com."
  var canonical_host = uri.hostname();
  if (canonical_host.charAt(canonical_host.length - 1) == ".") {
    while (canonical_host.charAt(canonical_host.length - 1) == ".")
      canonical_host = canonical_host.slice(0,-1);
  }
  uri.hostname(canonical_host);

  // If there is a username / password, put them aside during the ruleset
  // analysis process
  var tmpuserinfo = uri.userinfo();
  uri.userinfo('');

  var canonical_url = uri.toString();
  if (details.url != canonical_url && tmpuserinfo === '') {
    log(INFO, "Original url " + details.url + 
        " changed before processing to " + canonical_url);
  }
  if (canonical_url in urlBlacklist) {
    return null;
  }

  if (details.type == "main_frame") {
    activeRulesets.removeTab(details.tabId);
  }

  if (details.requestId in redirectCounter) {
    redirectCounter[details.requestId] += 1;
    log(DBUG, "Got redirect id "+details.requestId+
        ": "+redirectCounter[details.requestId]);
  } else {
    redirectCounter[details.requestId] = 0;
  }

  if (redirectCounter[details.requestId] > 9) {
    log(NOTE, "Redirect counter hit for "+canonical_url);
    urlBlacklist[canonical_url] = true;
    domainBlacklist[canonical_host] = true;
    log(WARN, "Domain blacklisted " + canonical_host);
    return null;
  }

  var newuristr = null;

  var rs = all_rules.potentiallyApplicableRulesets(canonical_host);
  for(var i = 0; i < rs.length; ++i) {
    activeRulesets.addRulesetToTab(details.tabId, rs[i]);
    if (rs[i].active && !newuristr)
      newuristr = rs[i].apply(canonical_url);
  }

  displayPageAction(details.tabId);

  if (newuristr && tmpuserinfo != "") {
    // re-insert userpass info which was stripped temporarily
    // while rules were applied
    var finaluri = new URI(newuristr);
    finaluri.userinfo(tmpuserinfo);
    newuristr = finaluri.toString();
  }

  // In Switch Planner Mode, record any non-rewriteable
  // HTTP URIs by parent hostname, along with the resource type.
  if (switchPlannerMode && uri.protocol() !== "https") {
    // In order to figure out the document requesting this resource,
    // have to get the tab. TODO: any cheaper way?
    // XXX: Because this is async it's actually inaccurate during quick page
    // switches. Maybe it only matters when you're switching domains though?
    chrome.tabs.get(details.tabId, function(tab) {
      var tab_host = new URI(tab.url).hostname();
      if (tab_host !== canonical_host) {
        writeToSwitchPlanner(details.type,
                             tab_host,
                             canonical_host,
                             details.url,
                             newuristr);
      }
    });
  }

  if (newuristr) {
    log(DBUG, "Redirecting from "+details.url+" to "+newuristr);
    return {redirectUrl: newuristr};
  } else {
    return null;
  }
}


// Map of which values for the `type' enum denote active vs passive content.
// https://developer.chrome.com/extensions/webRequest.html#event-onBeforeRequest
var activeTypes = { stylesheet: 1, script: 1, object: 1, other: 1};
// We consider sub_frame to be passive even though it can contain JS or Flash.
// This is because code running the sub_frame cannot access the main frame's
// content, by same-origin policy. This is true even if the sub_frame is on the
// same domain but different protocol - i.e. HTTP while the parent is HTTPS -
// because same-origin policy includes the protocol. This also mimics Chrome's
// UI treatment of insecure subframes.
var passiveTypes = { main_frame: 1, sub_frame: 1, image: 1, xmlhttprequest: 1};

// Record a non-HTTPS URL loaded by a given hostname in the Switch Planner, for
// use in determining which resources need to be ported to HTTPS.
// TODO: Maybe unique by resource URL, so reloading a single page doesn't double
// the counts?
function writeToSwitchPlanner(type, tab_host, resource_host, resource_url, rewritten_url) {
  var rw = "rw";
  if (rewritten_url == null)
    rw = "no";

  var active_content = 0;
  if (activeTypes[type]) {
    active_content = 1;
  } else if (passiveTypes[type]) {
    active_content = 0;
  } else {
    log(WARN, "Unknown type from onBeforeRequest details: `" + type + "', assuming active");
    active_content = 1;
  }

  // Only add if we were unable to rewrite this URL.
  // TODO: Maybe also count rewritten URLs separately.
  if (rewritten_url != null) return;

  if (!switchPlanner[tab_host])
    switchPlanner[tab_host] = {};
  if (!switchPlanner[tab_host][resource_host])
    switchPlanner[tab_host][resource_host] = {};
  if (!switchPlanner[tab_host][resource_host][active_content])
    switchPlanner[tab_host][resource_host][active_content] = {};

  switchPlanner[tab_host][resource_host][active_content][resource_url] = 1;
}

// Return the number of properties in an object. For associative maps, this is
// their size.
function objSize(obj) {
  if (typeof obj == 'undefined') return 0;
  var size = 0, key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) size++;
  }
  return size;
}

// Format the switch planner output for presentation to a user.
function sortSwitchPlanner(tab_host) {
  var output = "";

  var asset_host_list = [];
  var parentInfo = switchPlanner[tab_host];
  // Make an array of asset hosts by score so we can sort them,
  // presenting the most important ones first.
  for (var asset_host in parentInfo) {
    var ah = parentInfo[asset_host];
    var activeCount = objSize(ah[1]);
    var passiveCount = objSize(ah[0]);
    asset_host_list.push([activeCount * 100 + passiveCount, activeCount, passiveCount, asset_host]);
  }
  asset_host_list.sort(function(a,b){return a[0]-b[0]});
  for (var i = asset_host_list.length - 1; i >= 0; i--) {
    var host = asset_host_list[i][3];
    var activeCount = asset_host_list[i][1];
    var passiveCount = asset_host_list[i][2];

    output += host + ": ";
    if (activeCount > 0) {
      output += activeCount + " active";
      if (passiveCount > 0)
        output += ", ";
    }
    if (passiveCount > 0) {
      output += passiveCount + " passive";
    }
    output += "\n";
  }
  return output;
}

function onCookieChanged(changeInfo) {
  if (!changeInfo.removed && !changeInfo.cookie.secure) {
    if (all_rules.shouldSecureCookie(changeInfo.cookie, false)) {
      var cookie = {name:changeInfo.cookie.name,value:changeInfo.cookie.value,
                    domain:changeInfo.cookie.domain,path:changeInfo.cookie.path,
                    httpOnly:changeInfo.cookie.httpOnly,
                    expirationDate:changeInfo.cookie.expirationDate,
                    storeId:changeInfo.cookie.storeId};
      cookie.secure = true;
      // FIXME: What is with this url noise? are we just supposed to lie?
      if (cookie.domain[0] == ".") {
        cookie.url = "https://www"+cookie.domain+cookie.path;
      } else {
        cookie.url = "https://"+cookie.domain+cookie.path;
      }
      // We get repeated events for some cookies because sites change their
      // value repeatedly and remove the "secure" flag.
      log(DBUG,
       "Securing cookie "+cookie.name+" for "+cookie.domain+", was secure="+changeInfo.cookie.secure);
      chrome.cookies.set(cookie);
    }
  }
}

// Check to see if a newly set cookie in an HTTP request should be secured
function onHeadersReceived(details) {
  var a = document.createElement("a");  // hack to parse URLs
  a.href = details.url;                 //
  var host = a.hostname;

  // TODO: Verify this with wireshark
  for (var h in details.responseHeaders) {
    if (details.responseHeaders[h].name == "Set-Cookie") {
      log(INFO,"Deciding whether to secure cookies in " + details.url);
      var cookie = details.responseHeaders[h].value;

      if (cookie.indexOf("; Secure") == -1) {
        log(INFO, "Got insecure cookie header: "+cookie);
        // Create a fake "nsICookie2"-ish object to pass in to our rule API:
        var fake = {domain:host, name:cookie.split("=")[0]};
        var ruleset = all_rules.shouldSecureCookie(fake, true);
        if (ruleset) {
          activeRulesets.addRulesetToTab(details.tabId, ruleset);
          details.responseHeaders[h].value = cookie+"; Secure";
          log(INFO, "Secured cookie: "+details.responseHeaders[h].value);
        }
      }
    }
  }

  return {responseHeaders:details.responseHeaders};
}

// This event is needed due to the potential race between cookie permissions
// update and cookie transmission, becuase the cookie API is non-blocking..
// It would be less perf impact to have a blocking version of the cookie API
// available instead.
function onBeforeSendHeaders(details) {
  // XXX this function appears to enforce something equivalent to the secure
  // cookie flag by independent means.  Is that really what it's supposed to
  // do?
  var a = document.createElement("a");
  a.href = details.url;
  var host = a.hostname;

  // TODO: Verify this with wireshark
  for (var h in details.requestHeaders) {
    if (details.requestHeaders[h].name == "Cookie") {
      var newCookies = [];
      var cookies = details.requestHeaders[h].value.split(";");

      for (var c in cookies) {
        // Create a fake "nsICookie2"-ish object to pass in to our rule API:
        var fake = {domain:host, name:cookies[c].split("=")[0]};
        // XXX I have no idea whether the knownHttp parameter should be true
        // or false here.  We're supposedly inside a race condition or
        // something, right?
        var ruleset = all_rules.shouldSecureCookie(fake, false);
        if (ruleset) {
          activeRulesets.addRulesetToTab(details.tabId, ruleset);
          log(INFO, "Woah, we lost the race on updating a cookie: "+details.requestHeaders[h].value);
        } else {
          newCookies.push(cookies[c]);
        }
      }
      details.requestHeaders[h].value = newCookies.join(";");
      log(DBUG, "Got new cookie header: "+details.requestHeaders[h].value);
    }
  }

  return {requestHeaders:details.requestHeaders};
}

function onResponseStarted(details) {

  // redirect counter workaround
  // TODO: Remove this code if they ever give us a real counter
  if (details.requestId in redirectCounter) {
    delete redirectCounter[details.requestId];
  }
}

function onErrorOccurred(details) {
  displayPageAction(details.tabId);
}

function onCompleted(details) {
  displayPageAction(details.tabId);
}

wr.onBeforeRequest.addListener(onBeforeRequest, {urls: ["https://*/*", "http://*/*"]}, ["blocking"]);

// This watches cookies sent via HTTP.
// We do *not* watch HTTPS cookies -- they're already being sent over HTTPS -- yay!
wr.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {urls: ["http://*/*"]},
                                   ["requestHeaders", "blocking"]);

// This parses HTTPS cookies and may set their secure flag.
// We never do this for cookies set by HTTP.
wr.onHeadersReceived.addListener(onHeadersReceived, {urls: ["https://*/*"]},
                                    ["responseHeaders", "blocking"]);

wr.onResponseStarted.addListener(onResponseStarted,
                                 {urls: ["https://*/*", "http://*/*"]});
wr.onErrorOccurred.addListener(onErrorOccurred,
                               {urls: ["https://*/*", "http://*/*"]});
wr.onCompleted.addListener(onCompleted,
                           {urls: ["https://*/*", "http://*/*"]});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    displayPageAction(tabId);
});

chrome.cookies.onChanged.addListener(onCookieChanged);
