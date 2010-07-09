//INCLUDE('STS', 'Cookie');
// XXX: Disable STS for now.
var STS = {
  isSTSURI : function(uri) {
    return false;
  }
};

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
  secureCookies: false,
  secureCookiesExceptions: null,
  secureCookiesForced: null,
  httpsForced: null,
  httpsForcedExceptions: null,
  httpsRewrite: null,
  
  forceChannel: function(channel) {
    return this.forceURI(channel.URI, function() { HTTPS.replaceChannel(channel); });
  },
  
  replaceChannel: function(channel) {

    var c2=channel.QueryInterface(CI.nsIHttpChannel);
    this.log(DBUG,"Redirection limit is " + c2.redirectionLimit);
    // XXX This used to be (c2.redirectionLimit == 1), but that's very
    // inefficient in a case (eg amazon) where this may happen A LOT.
    // Rather than number like 10, we should use the starting value
    // in network.http.redirection-limit minus some counter
    if (c2.redirectionLimit < 10) {
      this.log(WARN, "Redirection loop trying to set HTTPS on:\n  " +
      channel.URI.spec +"\n(falling back to HTTP)");
      https_everywhere_blacklist[channel.URI.spec] = true;
      return false;
    }
    if (ChannelReplacement.supported) {
      IOUtil.runWhenPending(channel, function() {
        // replacing a shortcut icon causes a cache-related crash like
        // https://bugzilla.mozilla.org/show_bug.cgi?id=480352
        // just abort it... 
        try {
         if (/\bimage\//.test(channel.getRequestHeader("Accept")) &&
             !PolicyState.extract(channel) // favicons don't trigger content policies
            ) {
           HTTPS.log(WARN,"Aborting shortcut icon " + channel.name + ", should be HTTPS!");
           IOUtil.abort(channel);
           return;
         }
        } catch(e) {}
        var uri = HTTPSRules.rewrittenURI(channel.URI.clone());
        if (!uri) return;
        new ChannelReplacement(channel, uri).replace(true).open();
      });
      return true;
    }
    
    this.log(WARN,"Aborting redirection " + channel.name + ", should be HTTPS!");
    IOUtil.abort(channel);
    return false;
  },
  
  forceURI: function(uri, fallback, ctx) {
  // Switch some uris to https; ctx is either nsIDOMNode or nsIDOMWindow as
  // per the ContentPolicy API.
  // Returns true if everything worked out (either correct replacement or no 
  // replacement needed).  Retun False if all attempts to rewrite failed.

    try {
      if (HTTPSRules.replaceURI(uri)) {
        this.log(INFO,"Forced URI " + uri.spec);
      } else {
        this.log(DBUG,"No change to " + uri.spec);
      }
      return true;
    } catch(e) {
        
      if (ctx && (ctx instanceof CI.nsIDOMHTMLImageElement || ctx instanceof CI.nsIDOMHTMLInputElement)) {
        var newuri = HTTPSRules.rewrittenURI(uri);
        if (!newuri) {
          this.log(WARN, "SHOULD NEVER HAPPEN");
          return true; // this should never happen
        }

        // XXX Isn't this a security flaw?  Have to bug Georgio about
        // this... the content policy docs claim to require it, but
        // it looks like a race condition nightmare.
        Thread.asap(function() { ctx.src = newuri.spec; });
        
        var msg = "Image HTTP->HTTPS redirection to " + newuri.spec;
        this.log(INFO,msg);  
        throw msg;
      }
      
      if (fallback && fallback()) {
         this.log(WARN,"Channel redirection fallback on " + newuri.spec);
         return true;
      }
      
      this.log(WARN,"Firefox wouldn't set https on " + newuri.spec);
      this.log(INFO,"(error was " + e + ")");
    }
    return false;
  },
  
  log: function(msg) {
    this.log = ns.getPref("https.showInConsole", true)
      ? function(msg) { ns.log("[NoScript HTTPS] " + msg); }
      : function(msg) {}
      
    return this.log(msg);
  },
  
  onCrossSiteRequest: function(channel, origin, browser, rw) {
    try {
      this.handleCrossSiteCookies(channel, origin, browser);
    } catch(e) {
      this.log(WARN, e + " --- " + e.stack);
    }
  },
  
  registered: false,
  handleSecureCookies: function(req) {
  /*
    we check HTTPS responses setting cookies and
    1) if host is in the noscript.secureCookiesExceptions list we let
     it pass through
    2) if host is in the noscript.secureCookiesForced list we append a
       ";Secure" flag to every non-secure cookie set by this response
    3) otherwise, we just log unsafe cookies BUT if no secure cookie
       is set, we patch all these cookies with ";Secure" like in #2.
       However, if current request redirects (directly or indirectly)
       to an unencrypted final URI, we remove our ";Secure" patch to
       ensure compatibility (ref: mail.yahoo.com and hotmail.com unsafe
       behavior on 11 Sep 2008)
  */
    
    if (!this.secureCookies) return;
    
    var uri = req.URI;
    
    if (uri.schemeIs("https") &&
        !(this.secureCookiesExceptions && this.secureCookiesExceptions.test(uri.spec)) &&
        (req instanceof CI.nsIHttpChannel)) {
      try {
        var host = uri.host;
        try {
          var cookies = req.getResponseHeader("Set-Cookie");
        } catch(mayHappen) {
          return;
        }
        if (cookies) {
          var forced = this.secureCookiesForced && this.secureCookiesForced.test(uri.spec);
          var secureFound = false;
          var unsafe = null;
         
          const rw = ns.requestWatchdog;
          var browser = rw.findBrowser(req);
          
          if (!browser) {
            if (ns.consoleDump) ns.dump("Browser not found for " + uri.spec);
          }
          
          var unsafeMap = this.getUnsafeCookies(browser) || {};
          var c;
          for each (var cs in cookies.split("\n")) {
            c = new Cookie(cs, host);
            if (c.secure && c.belongsTo(host)) {
              this.log(WARN,"Secure cookie set by " + host + ": " + c);
              secureFound = c;
              delete unsafeMap[c.id];
            } else {
              if (!unsafe) unsafe = [];
              unsafe.push(c);
            }
          }
        
          
          if (unsafe && !(forced || secureFound)) {
            // this page did not set any secure cookie, let's check if we already have one
            secureFound = Cookie.find(function(c) {
              return (c instanceof CI.nsICookie) && (c instanceof CI.nsICookie2)
                && c.secure && !unsafe.find(function(x) { return x.sameAs(c); })
            });
            if (secureFound) {
              this.log(WARN,"Secure cookie found for this host: " + Cookie.prototype.toString.apply(secureFound));
            }
          }
          
          if (secureFound && !forced) {
            this.cookiesCleanup(secureFound);
            return;
          }
          
          if (!unsafe) return;

          var msg;
          if (forced || !secureFound) {
            req.setResponseHeader("Set-Cookie", "", false);
            msg = forced ? "FORCED SECURE" : "AUTOMATIC SECURE";
            forced = true;
          } else {
            msg = "DETECTED INSECURE";
          }
          
          if (!this.registered) {
            this.registered = true;
            rw.addCrossSiteListener(this);
          }
          
          this.setUnsafeCookies(browser, unsafeMap);
          msg += " on https://" + host + ": ";
          for each (c in unsafe) {
            if (forced) {
              c.secure = true;
              req.setResponseHeader("Set-Cookie", c.source + ";Secure", true);
              unsafeMap[c.id] = c;
            }
            this.log(WARN,msg + c);
          }
          
        }
      } catch(e) {
        if (ns.consoleDump) ns.dump(e);
      }
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
      this.log(WARN,uri.prePath + " cannot support secure cookies because it does not use HTTPS. Consider forcing HTTPS for " + uri.host + " in NoScript's Advanced HTTPS options panel.")
    }
    
    var cs = CC['@mozilla.org/cookieService;1'].getService(CI.nsICookieService).getCookieString(uri, req);
      
    for each (c in dcookies) {
      c.secure = dsecure;
      c.save();
      this.log(WARN,"Toggled secure flag on " + c);
    }

    if (cs) {
      Array.prototype.push.apply(
        dcookies, cs.split(/\s*;\s*/).map(function(cs) { var nv = cs.split("="); return { name: nv.shift(), value: nv.join("=") } })
         .filter(function(c) { return dcookies.every(function(x) { return x.name != c.name }) })
      );
    }

    cs = dcookies.map(function(c) { return c.name + "=" + c.value }).join("; ");

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
  
  shouldForbid: function(site) {
    switch(this.allowHttpsOnly) {
      case 0:
        return false;
      case 1:
        return /^(?:ht|f)tp:\/\//.test(site) && this.isProxied(site);
      case 2:
        return /^(?:ht|f)tp:\/\//.test(site);
    }
    return false;
  },
  
  isProxied: function(u) {
    var ps = CC["@mozilla.org/network/protocol-proxy-service;1"].getService(CI.nsIProtocolProxyService);
   
    this.isProxied = function(u) {
      try {
        if (!(u instanceof CI.nsIURI)) {
          u = IOS.newURI(u, null, null);
        }
        return ps.resolve(u, 0).type != "direct";
      } catch(e) {
        return false;
      }
    }
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
      HTTPS.cookiesCleanup();
      return v;
    });
  });
})();



