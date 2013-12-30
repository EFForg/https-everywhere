
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

// If a ruleset could apply to a tab, then add the little HTTPS
// Everywhere icon to the address bar.
function displayPageAction(tabId) {
  if (tabId !== -1 && this.activeRulesets.getRulesets(tabId)) {
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
  var tmpuri = new URI(details.url);

  // Normalise hosts such as "www.example.com."
  var tmphost = tmpuri.hostname();
  if (tmphost.charAt(tmphost.length - 1) == ".") {
    while (tmphost.charAt(tmphost.length - 1) == ".") {
      tmphost = tmphost.slice(0,-1);
    }
  tmpuri.hostname(tmphost);  // No need to update the hostname unless it's changed.
  }

  // If there is a username / password, put them aside during the ruleset
  // analysis process
  var tmpuserinfo = tmpuri.userinfo();
  if (tmpuserinfo) {
      tmpuri.userinfo('');
  }

  var canonical_url = tmpuri.toString();
  if (details.url != canonical_url && tmpuserinfo === '') {
    log(INFO, "Original url " + details.url + 
        " changed before processing to " + canonical_url);
  }
  if (canonical_url in urlBlacklist) {
    return;
  }

  var a = document.createElement("a");
  a.href = canonical_url;

  if (details.type == "main_frame") {
    activeRulesets.removeTab(details.tabId);
  }

  var rs = all_rules.potentiallyApplicableRulesets(a.hostname);
  // If no rulesets could apply, let's get out of here!
  if (rs.length === 0) { return; }

  if (details.requestId in redirectCounter) {
    redirectCounter[details.requestId] += 1;
    log(DBUG, "Got redirect id "+details.requestId+
        ": "+redirectCounter[details.requestId]);

    if (redirectCounter[details.requestId] > 9) {
        log(NOTE, "Redirect counter hit for "+canonical_url);
        urlBlacklist[canonical_url] = true;
        var hostname = tmpuri.hostname();
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

  if (newuristr) {
    // re-insert userpass info which was stripped temporarily
    // while rules were applied
    var finaluri = new URI(newuristr);
    if (tmpuserinfo) {
        finaluri.userinfo(tmpuserinfo);
    }
    var finaluristr = finaluri.toString();
    log(DBUG, "Redirecting from "+a.href+" to "+finaluristr);
    return {redirectUrl: finaluristr};
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
// update and cookie transmission, because the cookie API is non-blocking.
// It would be less perf impact to have a blocking version of the cookie API
// available instead.
// WARNING: This is a very hot function.
function onBeforeSendHeaders(details) {
  // XXX this function appears to enforce something equivalent to the secure
  // cookie flag by independent means.  Is that really what it's supposed to
  // do?
  // @@@ Agreed, this function is really weird. I'm not sure it's even useful
  // since we block WebRequests to HTTP sites (and maybe rewrite them to SSL)
  // we force cookies to be sent over HTTPS even if they don't have the flag
  // "Secure" set. (Unless I'm reading this wrong?)
  // TODO: Verify this with wireshark
  for (var h in details.requestHeaders) {
    if (details.requestHeaders[h].name == "Cookie") {
      // Per RFC 6265, Chrome sends only ONE cookie header, period.
      var a = document.createElement("a");
      a.href = details.url;
      var host = a.hostname;

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

// This parses HTTPS cookies and may set their secure flag.
// We never do this for cookies set by HTTP.
wr.onHeadersReceived.addListener(onHeadersReceived, {urls: ["https://*/*"]},
                                    ["responseHeaders", "blocking"]);

// Remove a tab from the redirectCounter when we've started a response.
wr.onResponseStarted.addListener(onResponseStarted,
                                 {urls: ["https://*/*", "http://*/*"]});

// Add the small HTTPS Everywhere icon in the address bar if any rules apply to this tab.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    displayPageAction(tabId);
});

// Listen for cookies set/updated and secure them if applicable. This function is async/nonblocking,
// so we also use onBeforeSendHeaders to prevent a small window where cookies could be stolen.
chrome.cookies.onChanged.addListener(onCookieChanged);


// Intermittently call displayPageAction(). chrome.tabs.onUpdated (above) adds the HTTPS Everywhere icon
// via displayPageAction to 99.9% of pages. In the /rare/ case where /absolutely no elements/ of a tab have
// any applicable rulesets, but the page later loads one (without triggering chrome.tabs.onUpdated), this will
// add the HTTPS Everywhere icon.
//
// In practice, this is incredibly rare. If people don't mind the HTTPS Everywhere icon being always visible in
// either the address bar or via pageAction, we could consider having it /always/ visible (it usually is anyway),
// or adding a browser_action instead, which would change the UI/UX slightly.
function periodically_displayPageAction() {
    // Get all available active tabs
    chrome.tabs.query({active: true},
        function(tabs_array) {
            // Pass active tabIDs to displayPageAction
            tabs_array.map(function(tab){return tab.id}).map(displayPageAction);
        } );
    // Call ourself every 10 seconds.
    setTimeout(periodically_displayPageAction, 10000);
}
periodically_displayPageAction();
