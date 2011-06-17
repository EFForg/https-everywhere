const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const CI = Components.interfaces;
const CC = Components.classes;
const CR = Components.results;

// Log levels
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

// XXX: We should make the _observatory tree relative.
LLVAR="extensions.https_everywhere.LogLevel";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const OS = Cc['@mozilla.org/observer-service;1'].getService(CI.nsIObserverService);

const SERVICE_CTRID = "@eff.org/ssl-observatory;1";
const SERVICE_ID=Components.ID("{0f9ab521-986d-4ad8-9c1f-6934e195c15c}");
const SERVICE_NAME = "Anonymously Submits strange SSL certificates to EFF.";
const LOADER = CC["@mozilla.org/moz/jssubscript-loader;1"].getService(CI.mozIJSSubScriptLoader);

const _INCLUDED = {};
const INCLUDE = function(name) {
  if (arguments.length > 1)
    for (var j = 0, len = arguments.length; j < len; j++)
      INCLUDE(arguments[j]);
  else if (!_INCLUDED[name]) {
    try {
      LOADER.loadSubScript("chrome://https-everywhere/content/code/"
              + name + ".js");
      _INCLUDED[name] = true;
    } catch(e) {
      dump("INCLUDE " + name + ": " + e + "\n");
    }
  }
}

INCLUDE('Root-CAs');

function SSLObservatory() {
  this.prefs = CC["@mozilla.org/preferences-service;1"]
        .getService(CI.nsIPrefBranch);

  try {
    // Check for torbutton
    this.tor_logger = CC["@torproject.org/torbutton-logger;1"]
          .getService(CI.nsISupports).wrappedJSObject;
    this.torbutton_installed = true;
  } catch(e) {
    this.torbutton_installed = false;
  }

  this.public_roots = root_ca_hashes;

  // Clear this on cookies-cleared observer event
  this.already_submitted = {};
  OS.addObserver(this, "cookie-changed", false);

  // XXX: Read these from a file? Or hardcode them?
  this.popular_fps = {};

  // The url to submit to
  this.submit_url = "https://observatory.eff.org/submit_cert";

  // Generate nonce to append to url, to catch in nsIProtocolProxyFilter
  // and to protect against CSRF
  this.csrf_nonce = "#"+Math.random().toString()+Math.random().toString();

  this.compatJSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);

  // Register observer
  OS.addObserver(this, "http-on-examine-response", false);

  // Register protocolproxyfilter
  this.pps = CC["@mozilla.org/network/protocol-proxy-service;1"]
                    .getService(CI.nsIProtocolProxyService);

  this.pps.registerFilter(this, 0);
  this.wrappedJSObject = this;

  this.client_asn = -1;
  if (this.prefs.getBoolPref("extensions.https_everywhere._observatory.send_asn")) 
    this.setupASNWatcher();

  this.log(DBUG, "Loaded observatory component!");
}

SSLObservatory.prototype = {
  // QueryInterface implementation, e.g. using the generateQI helper
  QueryInterface: XPCOMUtils.generateQI(
    [ CI.nsIObserver,
      CI.nsIProtocolProxyFilter,
      CI.nsIWifiListener ]),

  wrappedJSObject: null,  // Initialized by constructor

  // properties required for XPCOM registration:
  classDescription: SERVICE_NAME,
  classID:          SERVICE_ID,
  contractID:       SERVICE_CTRID,

  // https://developer.mozilla.org/En/How_to_check_the_security_state_of_an_XMLHTTPRequest_over_SSL
  getSSLCert: function(channel) {
    try {
        // Do we have a valid channel argument?
        if (!channel instanceof Ci.nsIChannel) {
            return null;
        }
        var secInfo = channel.securityInfo;

        // Print general connection security state
        if (secInfo instanceof Ci.nsITransportSecurityInfo) {
            secInfo.QueryInterface(Ci.nsITransportSecurityInfo);
        } else {
            return null;
        }

        if (secInfo instanceof Ci.nsISSLStatusProvider) {
            return secInfo.QueryInterface(Ci.nsISSLStatusProvider).
                   SSLStatus.QueryInterface(Ci.nsISSLStatus).serverCert;
        }
        return null;
    } catch(err) {
      return null;
    }
  },

  setupASNWatcher: function() {
    this.getClientASN();

    this.max_ap = null;

    // Observe network changes to get new ASNs
    OS.addObserver(this, "network:offline-status-changed", false);
    var pref_service = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefBranchInternal);
    proxy_branch = pref_service.QueryInterface(Ci.nsIPrefBranchInternal);
    proxy_branch.addObserver("network.proxy", this, false);

    try {
      var wifi_service = Cc["@mozilla.org/wifi/monitor;1"].getService(Ci.nsIWifiMonitor);
      wifi_service.startWatching(this);
    } catch(e) {
      this.log(INFO, "Failed to register ASN change monitor: "+e);
    }
  },

  stopASNWatcher: function() {
    // XXX FIXME need to unhook the observers above, or do something more crude...
    this.client_asn = -1;
  },

  getClientASN: function() {
    // XXX: Fetch a new client ASN..
    return;
  },

  // Wifi status listener
  onChange: function(accessPoints) {
    var max_ap = accessPoints[0].mac;
    var max_signal = accessPoints[0].signal;
    var old_max_present = false;
    for (var i=0; i<accessPoints.length; i++) {
      if (accessPoints[i].mac == this.max_ap) {
        old_max_present = true;
      }
      if (accessPoints[i].signal > max_signal) {
        max_ap = accessPoints[i].mac;
        max_signal = accessPoints[i].signal;
      }
    }
    this.max_ap = max_ap;
    if (!old_max_present) {
      this.log(INFO, "Old access point is out of range. Getting new ASN");
      this.getClientASN();
    } else {
      this.log(DBUG, "Old access point is still in range.");
    }
  },

  // Wifi status listener
  onError: function(value) {
    // XXX: Do we care?
    this.log(NOTE, "ASN change observer got an error: "+value);
    this.getClientASN();
  },


  observe: function(subject, topic, data) {
    if (topic == "cookie-changed" && data == "cleared") {
      this.already_submitted = {};
      this.log(INFO, "Cookies were cleared. Purging list of already submitted sites");
      return;
    }

    if (topic == "nsPref:changed") {
      // XXX: We somehow need to only call this once. Right now, we'll make
      // like 3 calls to getClientASN().. The only thing I can think
      // of is a timer...
      if (data == "network.proxy.ssl" || data == "network.proxy.ssl_port" ||
          data == "network.proxy.socks" || data == "network.proxy.socks_port") {
        this.log(INFO, "Proxy settings have changed. Getting new ASN");
        this.getClientASN();
      }
      return;
    }

    if (topic == "network:offline-status-changed" && data == "online") {
      this.log(INFO, "Browser back online. Getting new ASN.");
      this.getClientASN();
      return;
    }

    if ("http-on-examine-response" == topic) {
      if (this.torbutton_installed) {
        // Allow Tor users to choose if they want to submit
        // during tor and/or non-tor
        if (!this.prefs.getBoolPref("extensions.https_everywhere._observatory.submit_during_tor")
            && this.prefs.getBoolPref("extensions.torbutton.tor_enabled")) {
          return;
        }
        if (!this.prefs.getBoolPref("extensions.https_everywhere._observatory.submit_during_nontor")
            && !this.prefs.getBoolPref("extensions.torbutton.tor_enabled")) {
          return;
        }
      } else if (!this.prefs.getBoolPref("extensions.https_everywhere._observatory.use_custom_proxy")) {
        this.log(WARN, "No torbutton installed, but no custom proxies either. Not submitting certs");
        return;
      }

      subject.QueryInterface(Ci.nsIHttpChannel);
      var certchain = this.getSSLCert(subject);
      if (certchain) {
        var chainEnum = certchain.getChain();
        var chainArray = [];
        for(var i = 0; i < chainEnum.length; i++) {
          var cert = chainEnum.queryElementAt(i, Ci.nsIX509Cert);
          chainArray.push(cert);
        }

        if (subject.URI.port == -1) {
          this.submitChain(chainArray, new String(subject.URI.host));
        } else {
          this.submitChain(chainArray, subject.URI.host+":"+subject.URI.port);
        }
      }
    }
  },

  submitChain: function(certArray, domain) {
    var base64Certs = [];
    var fps = [];
    var rootidx = -1;

    for (var i = 0; i < certArray.length; i++) {
      var fp = (certArray[i].md5Fingerprint+certArray[i].sha1Fingerprint).replace(":", "", "g");
      fps.push(fp);
      if (certArray[i].issuer && certArray[i].equals(certArray[i].issuer)) {
        this.log(INFO, "Got root cert at position: "+i);
        rootidx = i;
      }
    }

    if (!this.prefs.getBoolPref("extensions.https_everywhere._observatory.alt_roots"))
      if (rootidx == -1 || (fps.length > 1 && !(fps[rootidx] in this.public_roots))) {
        if (rootidx == -1) {
          rootidx = fps.length-1;
        }
        this.log(INFO, "Got a private root cert. Ignoring domain "
                 +domain+" with root "+fps[rootidx]);
        return;
      }

    if (fps[0] in this.already_submitted) {
      this.log(INFO, "Already submitted cert for "+domain+". Ignoring");
      return;
    }

    if (fps[0] in this.popular_fps) {
      this.log(INFO, "Excluding popuar cert for "+domain);
      return;
    }

    var wm = CC["@mozilla.org/appshell/window-mediator;1"] 
                .getService(Components.interfaces.nsIWindowMediator);
    var browserWindow = wm.getMostRecentWindow("navigator:browser");
    for (var i = 0; i < certArray.length; i++) {
      var len = new Object();
      var derData = certArray[i].getRawDER(len);
      //var encoded = browserWindow.btoa(derData);  // seems to not be a real base 64 encoding!
      base64Certs.push(this.base64_encode(derData, false, false));
    }

    // TODO: Server ip??
    var reqParams = [];
    reqParams.push("domain="+domain);
    reqParams.push("server_ip=-1");
    if (this.prefs.getBoolPref("extensions.https_everywhere._observatory.testing")) {
      // The server can compute these, but they're a nice test suite item!
      reqParams.push("fplist="+this.compatJSON.encode(fps));
    }
    reqParams.push("certlist="+this.compatJSON.encode(base64Certs));
    // XXX: Should we indicate if this was a wifi-triggered asn fetch vs
    // the less reliable offline/online notification-triggered fetch?
    // this.max_ap will be null if we have no wifi info.
    reqParams.push("client_asn="+this.client_asn);
    reqParams.push("private_opt_in=1");

    var params = reqParams.join("&") + "&padding=0";
    var tot_len = 8192;

    this.log(INFO, "Submitting cert for "+domain);
    this.log(DBUG, "submit_cert params: "+params);

    // Pad to exp scale. This is done because the distribution of cert sizes
    // is almost certainly pareto, and definitely not uniform.
    for (tot_len = 8192; tot_len < params.length; tot_len*=2);

    while (params.length != tot_len) {
      params += "0";
    }

    //this.log(DBUG, "Padded params: "+params);

    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                 .createInstance(Ci.nsIXMLHttpRequest);
    req.open("POST", this.submit_url+this.csrf_nonce, true);

    // Send the proper header information along with the request
    // Do not set gzip header.. It will ruin the padding
    req.setRequestHeader("X-Privacy-Info", "EFF SSL Observatory: https://eff.org/r.22c");
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.setRequestHeader("Content-length", params.length);
    req.setRequestHeader("Connection", "close");
    // Need to clear useragent and other headers..
    req.setRequestHeader("User-Agent", "");
    req.setRequestHeader("Accept", "");
    req.setRequestHeader("Accept-Language", "");
    req.setRequestHeader("Accept-Encoding", "");
    req.setRequestHeader("Accept-Charset", "");

    var that = this; // We have neither SSLObservatory nor this in scope in the lambda
    req.onreadystatechange = function(evt) {
      if (req.readyState == 4) {
        // XXX: Handle errors properly?
        if (req.status == 200) {
          that.log(INFO, "Successful cert submission");
          if (!that.prefs.getBoolPref("extensions.https_everywhere._observatory.cache_submitted")) {
            if (fps[0] in that.already_submitted)
              delete that.already_submitted[fps[0]];
          }
        } else {
          if (fps[0] in that.already_submitted)
            delete that.already_submitted[fps[0]];
          try {
            that.log(WARN, "Cert submission failure "+req.status+": "+req.responseText);
          } catch(e) {
            that.log(WARN, "Cert submission failure and exception: "+e);
          }
        }
      }
    };

    // Cache this here to prevent multiple submissions for all the content elements.
    that.already_submitted[fps[0]] = true;
    req.send(params);
  },

  getProxySettings: function() {
    var proxy_settings = ["direct", "", 0];
    if (this.torbutton_installed &&
        this.prefs.getBoolPref("extensions.https_everywhere._observatory.use_tor_proxy")) {
      // extract torbutton proxy settings
      proxy_settings[0] = "http";
      proxy_settings[1] = this.prefs.getCharPref("extensions.torbutton.https_proxy");
      proxy_settings[2] = this.prefs.getIntPref("extensions.torbutton.https_port");

      if (proxy_settings[2] == 0) {
        proxy_settings[0] = "socks";
        proxy_settings[1] = this.prefs.getCharPref("extensions.torbutton.socks_host");
        proxy_settings[2] = this.prefs.getIntPref("extensions.torbutton.socks_port");
      }
    } else if (this.prefs.getBoolPref("extensions.https_everywhere._observatory.use_custom_proxy")) {
      proxy_settings[0] = this.prefs.getCharPref("extensions.https_everywhere._observatory.proxy_type");
      proxy_settings[1] = this.prefs.getCharPref("extensions.https_everywhere._observatory.proxy_host");
      proxy_settings[2] = this.prefs.getIntPref("extensions.https_everywhere._observatory.proxy_port");
    } else {
      this.log(WARN, "Proxy settings are strange: No Torbutton found, but no proxy specified. Using direct.");
    }
    return proxy_settings;
  },

  applyFilter: function(aProxyService, aURI, aProxy) {
    if (aURI.spec.search("^"+this.submit_url) != -1 &&
        aURI.path.search(this.csrf_nonce+"$") != -1) {

      this.log(INFO, "Got observatory url + nonce: "+aURI.spec);
      var proxy_settings = null;
      var proxy = null;

      // Send it through tor by creating an nsIProxy instance
      // for the torbutton proxy settings.
      try {
        proxy_settings = this.getProxySettings();
        proxy = this.pps.newProxyInfo(proxy_settings[0], proxy_settings[1],
                  proxy_settings[2],
                  Ci.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST,
                  0xFFFFFFFF, null);
      } catch(e) {
        this.log(WARN, "Error specifying proxy for observatory: "+e);
      }

      this.log(INFO, "Specifying proxy: "+proxy);

      // TODO: Use new identity or socks u/p to ensure we get a unique
      // tor circuit for this request
      return proxy;
    }
    return aProxy;
  },

  // [optional] an array of categories to register this component in.
  // Hack to cause us to get instantiate early
  _xpcom_categories: [ { category: "profile-after-change" }, ],

  encString: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  encStringS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',

  base64_encode: function(inp, uc, safe) {
    // do some argument checking
    if (arguments.length < 1) return null;
    var readBuf = new Array();    // read buffer
    if (arguments.length >= 3 && safe != true && safe != false) return null;
    var enc = (arguments.length >= 3 && safe) ? this.encStringS : this.encString; // character set used
    var b = (typeof inp == "string"); // how input is to be processed
    if (!b && (typeof inp != "object") && !(inp instanceof Array)) return null; // bad input
    if (arguments.length < 2) {
      uc = true;                  // set default
    } // otherwise its value is passed from the caller
    if (uc != true && uc != false) return null;
    var n = (!b || !uc) ? 1 : 2;  // length of read buffer
    var out = '';                 // output string
    var c = 0;                    // holds character code (maybe 16 bit or 8 bit)
    var j = 1;                    // sextett counter
    var l = 0;                    // work buffer
    var s = 0;                    // holds sextett

    // convert  
    for (var i = 0; i < inp.length; i++) {  // read input
      c = (b) ? inp.charCodeAt(i) : inp[i]; // fill read buffer
      for (var k = n - 1; k >= 0; k--) {
        readBuf[k] = c & 0xff;
        c >>= 8;
      }
      for (var m = 0; m < n; m++) {         // run through read buffer
        // process bytes from read buffer
        l = ((l<<8)&0xff00) | readBuf[m];   // shift remaining bits one byte to the left and append next byte
        s = (0x3f<<(2*j)) & l;              // extract sextett from buffer
        l -=s;                              // remove those bits from buffer;
        out += enc.charAt(s>>(2*j));        // convert leftmost sextett and append it to output
        j++;
        if (j==4) {                         // another sextett is complete
          out += enc.charAt(l&0x3f);        // convert and append it
          j = 1;
        }
      }        
    }
    switch (j) {                            // handle left-over sextetts
      case 2:
        s = 0x3f & (16 * l);                // extract sextett from buffer
        out += enc.charAt(s);               // convert leftmost sextett and append it to output
        out += '==';                        // stuff
        break;
      case 3:
        s = 0x3f & (4 * l);                 // extract sextett from buffer
        out += enc.charAt(s);               // convert leftmost sextett and append it to output
        out += '=';                         // stuff
        break;
      default:
        break;
    }

    return out;
  },

  log: function(level, str) {
    var econsole = CC["@mozilla.org/consoleservice;1"]
      .getService(CI.nsIConsoleService);
    try {
      var threshold = this.prefs.getIntPref(LLVAR);
    } catch (e) {
      econsole.logStringMessage( "SSL Observatory: Failed to read about:config LogLevel");
      threshold = WARN;
    }
    if (level >= threshold) {
      dump("SSL Observatory: "+str+"\n");
      econsole.logStringMessage("SSL Observatory: " +str);
    }
  }
};

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([SSLObservatory]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([SSLObservatory]);
