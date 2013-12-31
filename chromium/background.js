
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

// Add the HTTPS Everywhere icon to the URL address bar.
// TODO: Switch from pageAction to browserAction?
function displayPageAction(tabId) {
  if (tabId !== -1) {
    chrome.tabs.get(tabId, function(tab) {
      if(typeof(tab) === "undefined") {
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
    uri.hostname(canonical_host);
  }

  // If there is a username / password, put them aside during the ruleset
  // analysis process
  var tmpuserinfo = uri.userinfo();
  if (tmpuserinfo) {
    uri.userinfo('');
  }

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

  var rs = all_rules.potentiallyApplicableRulesets(uri.hostname());
  // If no rulesets could apply, let's get out of here!
  if (rs.length === 0) { return; }

  if (details.requestId in redirectCounter) {
    redirectCounter[details.requestId] += 1;
    log(DBUG, "Got redirect id "+details.requestId+
        ": "+redirectCounter[details.requestId]);

    if (redirectCounter[details.requestId] > 9) {
        log(NOTE, "Redirect counter hit for "+canonical_url);
        urlBlacklist[canonical_url] = true;
        var hostname = uri.hostname();
        domainBlacklist[hostname] = true;
        log(WARN, "Domain blacklisted " + hostname);
        return;
    }
  } else {
    redirectCounter[details.requestId] = 0;
  }

  var newuristr = null;

  for(var i = 0; i < rs.length; ++i) {
    activeRulesets.addRulesetToTab(details.tabId, rs[i]);
    if (rs[i].active && !newuristr) {
      newuristr = rs[i].apply(canonical_url);
    }
  }

  if (newuristr && tmpuserinfo !== "") {
    // re-insert userpass info which was stripped temporarily
    // while rules were applied
    var finaluri = new URI(newuristr);
    finaluri.userinfo(tmpuserinfo);
    newuristr = finaluri.toString();
  }

  if (newuristr) {
    log(DBUG, "Redirecting from "+details.url+" to "+newuristr);
    return {redirectUrl: newuristr};
  } else {
    return null;
  }
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

// This event is needed due to the potential race between cookie permissions
// update and cookie transmission (because the cookie API is non-blocking).
// Without this function, an aggressive attacker could race to steal a not-yet-secured
// cookie if they controlled & could redirect the user to a non-SSL subdomain.
// WARNING: This is a very hot function.
function onBeforeSendHeaders(details) {
  // TODO: Verify this with wireshark
  for (var h in details.requestHeaders) {
    if (details.requestHeaders[h].name == "Cookie") {
      // Per RFC 6265, Chrome sends only ONE cookie header, period.
      var uri = new URI(details.url);
      var host = uri.hostname();

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

      // We've seen the one cookie header, so let's get out of here!
      break;
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

wr.onBeforeRequest.addListener(onBeforeRequest, {urls: ["https://*/*", "http://*/*"]}, ["blocking"]);

// This watches cookies sent via HTTP.
// We do *not* watch HTTPS cookies -- they're already being sent over HTTPS -- yay!
wr.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {urls: ["http://*/*"]},
                                   ["requestHeaders", "blocking"]);

wr.onResponseStarted.addListener(onResponseStarted,
                                 {urls: ["https://*/*", "http://*/*"]});


// Add the small HTTPS Everywhere icon in the address bar.
// Note: We can't use any other hook (onCreated, onActivated, etc.) because Chrome resets the
// pageActions on URL change. We should strongly consider switching from pageAction to browserAction.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    displayPageAction(tabId);
});

// Pre-rendered tabs / instant experiments sometimes skip onUpdated.
// See http://crbug.com/109557
chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
    displayPageAction(addedTabId);
});

// Listen for cookies set/updated and secure them if applicable. This function is async/nonblocking,
// so we also use onBeforeSendHeaders to prevent a small window where cookies could be stolen.
chrome.cookies.onChanged.addListener(onCookieChanged);
