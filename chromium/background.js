
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
  this.active_tab_rules = {}

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
  var tmpuri = new URI(details.url);

  // Normalise hosts such as "www.example.com."
  var tmphost = tmpuri.hostname();
  if (tmphost.charAt(tmphost.length - 1) == ".") {
    while (tmphost.charAt(tmphost.length - 1) == ".")
      tmphost = tmphost.slice(0,-1);
  }
  tmpuri.hostname(tmphost);

  // If there is a username / password, put them aside during the ruleset
  // analysis process
  var tmpuserinfo = tmpuri.userinfo();
  tmpuri.userinfo('');

  var canonical_url = tmpuri.toString();
  if (details.url != canonical_url && tmpuserinfo == '') {
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
    var hostname = tmpuri.hostname();
    domainBlacklist[hostname] = true;
    log(WARN, "Domain blacklisted " + hostname);
    return;
  }

  var newuristr = null;

  var i = 0;

  var rs = all_rules.potentiallyApplicableRulesets(a.hostname);
  for(i = 0; i < rs.length; ++i) {
    activeRulesets.addRulesetToTab(details.tabId, rs[i]);
    if (rs[i].active && !newuristr)
      newuristr = rs[i].apply(canonical_url);
  }

  displayPageAction(details.tabId);

  if (newuristr) {
    // re-insert userpass info which was stripped temporarily
    // while rules were applied
    var finaluri = new URI(newuristr);
    finaluri.userinfo(tmpuserinfo);
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

  if(a.protocol != "https:") {
    // Never flag a cookie as secure if it's being set over HTTP
    return;
  }

  // TODO: Verify this with wireshark
  for (var h in details.responseHeaders) {
    if (details.responseHeaders[h].name == "Set-Cookie") {
      log(INFO,"Deciding whether to secure cookies in " + details.url);
      var cookie = details.responseHeaders[h].value;

      if (cookie.indexOf("; Secure") == -1) {
        log(INFO, "Got insecure cookie header: "+cookie);
        // Create a fake "nsICookie2"-ish object to pass in to our rule API:
        var fake = {domain:a.hostname, name:cookie.split("=")[0]};
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

  if(a.protocol == "https:") {
    // All cookies may be sent over https...
    return;
  }

  // TODO: Verify this with wireshark
  for (var h in details.requestHeaders) {
    if (details.requestHeaders[h].name == "Cookie") {
      var newCookies = [];
      var cookies = details.requestHeaders[h].value.split(";");

      for (var c in cookies) {
        // Create a fake "nsICookie2"-ish object to pass in to our rule API:
        var fake = {domain:a.hostname, name:cookies[c].split("=")[0]};
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
wr.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {urls: ["https://*/*", "http://*/*"]}, //{urls: ["*://*/*"]},
                                   ["requestHeaders", "blocking"]);
// FIXME: We probably do want all urls.. or at least http+https+spdy?
wr.onHeadersReceived.addListener(onHeadersReceived, {urls: ["https://*/*", "http://*/*"]},
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
