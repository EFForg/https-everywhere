INCLUDE('Cookie');

var securityService = CC['@mozilla.org/ssservice;1']
    .getService(CI.nsISiteSecurityService);

// Hack. We only need the part of the policystate that tracks content
// policy loading.
const PolicyState = {
  attach: function(channel) {
    IOUtil.attachToChannel(channel, "httpseverywhere.policyLoaded", true);
  },

  extract: function(channel) {
    var res = IOUtil.extractFromChannel(channel,
            "httpseverywhere.policyLoaded", true);
    return res;
  },
};

const HTTPS = {
  ready: false,

  secureCookies: true,
  secureCookiesExceptions: null,
  secureCookiesForced: null,
  httpsForced: null,
  httpsForcedExceptions: null,
  httpsRewrite: null,

  /**
   * Given a channel and a list of potentially applicable rules,
   * redirect or abort a request if appropriate.
   *
   * @param {RuleSet[]} applicable_list A list of potentially applicable rules
   *   (i.e. those that match on a hostname basis).
   * @param {nsIChannel} channel The channel to be manipulated.
   * @param {boolean} httpNowhereEnabled Whether to abort non-https requests.
   * @returns {boolean} True if the request was redirected; false if it was
   *   untouched or aborted.
   */
  replaceChannel: function(applicable_list, channel, httpNowhereEnabled) {
    var blob = HTTPSRules.rewrittenURI(applicable_list, channel.URI.clone());
    var isSTS = securityService.isSecureURI(
        CI.nsISiteSecurityService.HEADER_HSTS, channel.URI, 0);
    if (blob === null) {
      // Abort insecure requests if HTTP Nowhere is on
      if (httpNowhereEnabled && channel.URI.schemeIs("http") && !isSTS) {
        IOUtil.abort(channel);
      }
      return false; // no rewrite
    }
    var uri = blob.newuri;
    if (!uri) this.log(WARN, "OH NO BAD ARGH\nARGH");

    // Abort downgrading if HTTP Nowhere is on
    if (httpNowhereEnabled && uri.schemeIs("http")) {
      IOUtil.abort(channel);
    }

    var c2 = channel.QueryInterface(CI.nsIHttpChannel);
    this.log(DBUG, channel.URI.spec+": Redirection limit is " + c2.redirectionLimit);
    // XXX This used to be (c2.redirectionLimit == 1), but that's very
    // inefficient in a case (eg amazon) where this may happen A LOT.
    // Rather than number like 10, we should use the starting value
    // in network.http.redirection-limit minus some counter
    if (c2.redirectionLimit < 10) {
      this.log(WARN, "Redirection loop trying to set HTTPS on:\n  " +
      channel.URI.spec +"\n(falling back to HTTP)");
      if (!blob.applied_ruleset) {
        this.log(WARN,"Blacklisting rule for: " + channel.URI.spec);
        https_everywhere_blacklist[channel.URI.spec] = true;
      }
      https_everywhere_blacklist[channel.URI.spec] = blob.applied_ruleset;
      var domain = null;
      try { domain = channel.URI.host; } catch (e) {}
      if (domain) https_blacklist_domains[domain] = true;
      if (httpNowhereEnabled && channel.URI.schemeIs("http")) {
        IOUtil.abort(channel);
      }
      return false;
    }

    // Check for the new internal redirect API. If it exists, use it.
    if (!"redirectTo" in channel) {
      this.log(WARN, "nsIHTTPChannel.redirectTo API is missing. This version of HTTPS Everywhere is useless!!!!\n!!!\n");
      return false;
    }

    this.log(INFO, "Using nsIHttpChannel.redirectTo: " + channel.URI.spec + " -> " + uri.spec);
    try {
      channel.redirectTo(uri);
      return true;
    } catch(e) {
      // This should not happen. We should only get exceptions if
      // the channel was already open.
      this.log(WARN, "Exception on nsIHttpChannel.redirectTo: "+e);

      // Don't return: Fallback to NoScript ChannelReplacement.js
    }
    this.log(WARN,"Aborting redirection " + channel.name + ", should be HTTPS!");
    IOUtil.abort(channel);
    return false;
  },

  // getApplicableListForContext was remove along with the nsIContentPolicy
  // bindings and the and forceURI path that used them.
  
  onCrossSiteRequest: function(channel, origin, browser, rw) {
    try {
      this.handleCrossSiteCookies(channel, origin, browser);
    } catch(e) {
      this.log(WARN, e + " --- " + e.stack);
    }
  },
  
  registered: false,
  handleSecureCookies: function(req) {
    
    try {
      req = req.QueryInterface(CI.nsIHttpChannel);
    } catch(e) {
      this.log(WARN, "Request is not an nsIHttpChannel: " + req);
      return;
    }
    if (!this.secureCookies) return;
    var uri = req.URI;
    if (!uri) {
      this.log(WARN,"No URI inside request " +req);
      return;
    }
    //this.log(DBUG, "Cookie hunting in " + uri.spec);
    var alist = HTTPSEverywhere.instance.getApplicableListForChannel(req);
    if (!alist)
      this.log(INFO, "No alist for cookies for "+(req.URI) ? req.URI.spec : "???");
    
    if (uri.schemeIs("https")) {
      var host = uri.host;
      try {
        var cookies = req.getResponseHeader("Set-Cookie");
      } catch(mayHappen) {
        //this.log(VERB,"Exception hunting Set-Cookie in headers: " + mayHappen);
        return;
      }
      if (!cookies) return;
      var c;
      for each (var cs in cookies.split("\n")) {
        this.log(DBUG, "Examining cookie: ");
        c = new Cookie(cs, host);
        if (!c.secure && HTTPSRules.shouldSecureCookie(alist, c, true)) {
          this.log(INFO, "Securing cookie: " + c.domain + " " + c.name);
          c.secure = true;
          req.setResponseHeader("Set-Cookie", c.source + ";Secure", true);
        }
      }
      
    }
  },

  handleInsecureCookie: function(c) {
    if (HTTPSRules.shouldSecureCookie(null, c, false)) {
      this.log(INFO, "Securing cookie from event: " + c.host + " " + c.name);
      var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
                            .getService(Components.interfaces.nsICookieManager2);
      //some braindead cookies apparently use umghzabilliontrabilions
      var expiry = Math.min(c.expiry, Math.pow(2,31));
      cookieManager.remove(c.host, c.name, c.path, false);
      cookieManager.add(c.host, c.path, c.name, c.value, true, c.isHTTPOnly, c.isSession, expiry);
    }
  },
  
  handleCrossSiteCookies: function(req, origin, browser) {
     
    var unsafeCookies = this.getUnsafeCookies(browser);
    if (!unsafeCookies) return;
    
    var uri = req.URI;
    var dscheme = uri.scheme;
    
    var oparts = origin && origin.match(/^(https?):\/\/([^\/:]+).*?(\/.*)/);
    if (!(oparts && /https?/.test(dscheme))) return; 
    
    var oscheme = oparts[1];
    if (oscheme == dscheme) return; // we want to check only cross-scheme requests
    
    var dsecure = dscheme == "https";
    
    if (dsecure && !ns.getPref("secureCookies.recycle", false)) return;
   
    var dhost = uri.host;
    var dpath = uri.path;
    
    var ohost = oparts[2];
    var opath = oparts[3];
    
    var ocookieCount = 0, totCount = 0;
    var dcookies = [];
    var c;
    
    for (var k in unsafeCookies) {
      c = unsafeCookies[k];
      if (!c.exists()) {
        delete unsafeCookies[k];
      } else {
        totCount++;
        if (c.belongsTo(dhost, dpath) && c.secure != dsecure) { // either secure on http or not secure on https
          dcookies.push(c);
        }
        if (c.belongsTo(ohost, opath)) {
          ocookieCount++;
        }
      }
    }
    
    if (!totCount) {
      this.setUnsafeCookies(browser, null);
      return;
    }
    
    // We want to "desecurify" cookies only if cross-navigation to unsafe
    // destination originates from a site sharing some secured cookies

    if (ocookieCount == 0 && !dsecure || !dcookies.length) return; 
    
    if (dsecure) {
      this.log(WARN,"Detected cross-site navigation with secured cookies: " + origin + " -> " + uri.spec);
      
    } else {
      this.log(WARN,"Detected unsafe navigation with NoScript-secured cookies: " + origin + " -> " + uri.spec);
      this.log(WARN,uri.prePath + " cannot support secure cookies because it does not use HTTPS. Consider forcing HTTPS for " + uri.host + " in NoScript's Advanced HTTPS options panel.");
    }
    
    var cs = CC['@mozilla.org/cookieService;1'].getService(CI.nsICookieService).getCookieString(uri, req);
      
    for each (c in dcookies) {
      c.secure = dsecure;
      c.save();
      this.log(WARN,"Toggled secure flag on " + c);
    }

    if (cs) {
      dcookies.push.apply(
        dcookies, cs.split(/\s*;\s*/).map(function(cs) { var nv = cs.split("="); return { name: nv.shift(), value: nv.join("=") }; })
         .filter(function(c) { return dcookies.every(function(x) { return x.name != c.name; }); })
      );
    }

    cs = dcookies.map(function(c) { return c.name + "=" + c.value; }).join("; ");

    this.log(WARN,"Sending Cookie for " + dhost + ": " + cs);
    req.setRequestHeader("Cookie", cs, false); // "false" because merge syntax breaks Cookie header
  },
  
  
  cookiesCleanup: function(refCookie) {
    var downgraded = [];

    var ignored = this.secureCookiesExceptions;
    var disabled = !this.secureCookies;
    var bi = DOM.createBrowserIterator();
    var unsafe, k, c, total, deleted;
    for (var browser; browser = bi.next();) {
      unsafe = this.getUnsafeCookies(browser);
      if (!unsafe) continue;
      total = deleted = 0;
      for (k in unsafe) {
        c = unsafe[k];
        total++;
        if (disabled || (refCookie ? c.belongsTo(refCookie.host) : ignored && ignored.test(c.rawHost))) {
          if (c.exists()) {
            this.log(WARN,"Cleaning Secure flag from " + c);
            c.secure = false;
            c.save();
          }
          delete unsafe[k];
          deleted++;
        }
      }
      if (total == deleted) this.setUnsafeCookies(browser, null);
      if (!this.cookiesPerTab) break;
    }
  },
  
  get cookiesPerTab() {
    return ns.getPref("secureCookies.perTab", false);
  },
  
  _globalUnsafeCookies: {},
  getUnsafeCookies: function(browser) { 
    return this.cookiesPerTab
      ? browser && ns.getExpando(browser, "unsafeCookies")
      : this._globalUnsafeCookies;
  },
  setUnsafeCookies: function(browser, value) {
    return this.cookiesPerTab
      ? browser && ns.setExpando(browser, "unsafeCookies", value)
      : this._globalUnsafeCookies = value;
  },
  
  _getParent: function(req, w) {
    return  w && w.frameElement || DOM.findBrowserForNode(w || IOUtil.findWindow(req));
  }
  
};

(function () {
  ["secureCookies", "secureCookiesExceptions", "secureCookiesForced"].forEach(function(p) {
    var v = HTTPS[p];
    delete HTTPS[p];
    HTTPS.__defineGetter__(p, function() {
      return v;
    });
    HTTPS.__defineSetter__(p, function(n) {
      v = n;
      if (HTTPS.ready) HTTPS.cookiesCleanup();
      return v;
    });
  });
})();

HTTPS.ready = true;
