INCLUDE('Cookie');
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
  ready: false,

  secureCookies: true,
  secureCookiesExceptions: null,
  secureCookiesForced: null,
  httpsForced: null,
  httpsForcedExceptions: null,
  httpsRewrite: null,
  
  replaceChannel: function(applicable_list, channel) {
    var blob = HTTPSRules.rewrittenURI(applicable_list, channel.URI);
    if (null == blob) return false; // no rewrite
    var uri = blob.newuri;
    if (!uri) this.log(WARN, "OH NO BAD ARGH\nARGH");

    var c2 = channel.QueryInterface(CI.nsIHttpChannel);
    this.log(DBUG,"Redirection limit is " + c2.redirectionLimit);
    // XXX This used to be (c2.redirectionLimit == 1), but that's very
    // inefficient in a case (eg amazon) where this may happen A LOT.
    // Rather than number like 10, we should use the starting value
    // in network.http.redirection-limit minus some counter
    if (c2.redirectionLimit < 10) {
      this.log(WARN, "Redirection loop trying to set HTTPS on:\n  " +
      channel.URI.spec +"\n(falling back to HTTP)");
      if (!blob.applied_ruleset) {
        this.log(WARN,"DEATH\nDEATH\nDEATH\nDEATH");
        https_everywhere_blacklist[channel.URI.spec] = true;
      }
      https_everywhere_blacklist[channel.URI.spec] = blob.applied_ruleset;
      return false;
    }

    // Check for the new internal redirect API. If it exists, use it.
    if ("redirectTo" in channel) {
      this.log(INFO, "Found nsIHttpChannel.redirectTo. Using it.");
      try {
        channel.redirectTo(uri);
        return true;
      } catch(e) {
        // This should not happen. We should only get exceptions if
        // the channel was already open.
        this.log(WARN, "Exception on nsIHttpChannel.redirectTo: "+e);

        // Don't return: Fallback to NoScript ChannelReplacement.js
      }
    }

    if (ChannelReplacement.supported) {
      HTTPSEverywhere.instance.notifyObservers(channel.URI, uri.spec);
      HTTPS.log(INFO,"Scheduling channel replacement for "+channel.URI.spec);
      ChannelReplacement.runWhenPending(channel, function() {
        var cr = new ChannelReplacement(channel, uri);
        cr.replace(true,null);
        cr.open();
        HTTPS.log(INFO,"Ran channel replacement for "+channel.URI.spec);
      });
      return true;
    }
    
    this.log(WARN,"Aborting redirection " + channel.name + ", should be HTTPS!");
    IOUtil.abort(channel);
    return false;
  },
 
  rewriteInPlace: function(old_uri, new_uri) {
    // Strategy 1: replace the parts of the old_uri piecewise.  Often this
    // works.  In some cases it doesn't.
    this.log(NOTE,"Rewriting " + old_uri.spec + " -> " + new_uri.spec + "\n");

    old_uri.scheme = new_uri.scheme;
    old_uri.userPass = new_uri.userPass;
    old_uri.username = new_uri.username;
    if (new_uri.password)
      old_uri.password = new_uri.password;
    old_uri.host = new_uri.host;
    old_uri.port = new_uri.port;
    old_uri.path = new_uri.path;
    return true;
  },

  getApplicableListForContext: function(ctx, uri) {
    var alist = null; 
    var domWin = null;
    if (!ctx) {
      this.log(NOTE, "No context loading " + uri.spec);
      return null;
    }
    if (ctx instanceof CI.nsIDOMWindow) {
      domWin = ctx.QueryInterface(CI.nsIDOMWindow);
      doc = domWin.document;
    } else if (ctx instanceof CI.nsIDOMNode) {
      var doc = ctx.QueryInterface(CI.nsIDOMNode).ownerDocument;
      if (! doc) {
        this.log(NOTE, "No Document for request " + uri.spec);
        return null;
      }
      domWin = doc.defaultView;
      //this.log(DBUG,"Coerced nsIDOMWin from Node: " + domWin);
    } else {
      this.log(WARN, "Context for " + uri.spec + 
                     "is some bizarre unexpected thing: " + ctx);
      return null;
    }
    return HTTPSEverywhere.instance.getApplicableListForDOMWin(domWin, "for context/forceURI");
  },

  forceURI: function(uri, fallback, ctx) {
  // Switch some uris to https; ctx is either nsIDOMNode or nsIDOMWindow as
  // per the ContentPolicy API.
  // Returns true if everything worked out (either correct replacement or no 
  // replacement needed).  Retun False if all attempts to rewrite failed.
    
    // first of all we need to get the applicable rules list to keep track of
    // what rulesets might have applied to this page
    this.log(VERB, "Context is " + ctx);
    var alist = this.getApplicableListForContext(ctx, uri);
    var blob = HTTPSRules.rewrittenURI(alist, uri);
    if (null == blob) return true;                          // no applicable rule
    var newuri = blob.newuri;

    try {
      HTTPSEverywhere.instance.notifyObservers(uri, newuri.spec);
      if (this.rewriteInPlace(uri, newuri)) 
        this.log(INFO,"Forced URI " + uri.spec);
      return true;
    } catch(e) {
        
      if (ctx &&
           (ctx instanceof CI.nsIDOMHTMLImageElement
            || ctx instanceof CI.nsIDOMHTMLInputElement
            || ctx instanceof CI.nsIObjectLoadingContent)) {

        var type, attr;
        if (ctx instanceof CI.nsIObjectLoadingContent) {
          type = "Object";
          attr = "data";
        } else {
          type = "Image";
          attr = "src";
        }
        // XXX Isn't this a security flaw?  Have to bug Georgio about
        // this... the content policy docs claim to require it, but
        // it looks like a race condition nightmare.
        Thread.asap(function() { ctx.setAttribute(attr, newuri.spec); });

        var msg = type + " HTTP->HTTPS redirection to " + newuri.spec;

        this.log(INFO,msg);  
        throw msg;
      }
      
      if (fallback && fallback()) {
         this.log(INFO, "Channel redirection fallback on " + uri.spec);
         return true;
      }
      
      this.log(WARN,"Firefox wouldn't set https on " + uri.spec);
      this.log(INFO,"(error was " + e + ")");
    }
    return false;
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
        if (!c.secure && HTTPSRules.shouldSecureCookie(alist, c)) {
          this.log(INFO, "Securing cookie: " + c.domain + " " + c.name);
          c.secure = true;
          req.setResponseHeader("Set-Cookie", c.source + ";Secure", true);
        }
      }
      
    }
  },

  handleInsecureCookie: function(c) {
    if (HTTPSRules.shouldSecureCookie(null, c)) {
      this.log(INFO, "Securing cookie from event: " + c.domain + " " + c.name);
      var cookieManager = Components.classes["@mozilla.org/cookiemanager;1"]
                            .getService(Components.interfaces.nsICookieManager2);
      //some braindead cookies apparently use umghzabilliontrabilions
      var expiry = Math.min(c.expiry, Math.pow(2,31))
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
      this.log(WARN,uri.prePath + " cannot support secure cookies because it does not use HTTPS. Consider forcing HTTPS for " + uri.host + " in NoScript's Advanced HTTPS options panel.")
    }
    
    var cs = CC['@mozilla.org/cookieService;1'].getService(CI.nsICookieService).getCookieString(uri, req);
      
    for each (c in dcookies) {
      c.secure = dsecure;
      c.save();
      this.log(WARN,"Toggled secure flag on " + c);
    }

    if (cs) {
      dcookies.push.apply(
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
