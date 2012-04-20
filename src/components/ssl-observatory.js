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

BASE_REQ_SIZE=4096;

// XXX: We should make the _observatory tree relative.
LLVAR="extensions.https_everywhere.LogLevel";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/ctypes.jsm");

const OS = Cc['@mozilla.org/observer-service;1'].getService(CI.nsIObserverService);

const SERVICE_CTRID = "@eff.org/ssl-observatory;1";
const SERVICE_ID=Components.ID("{0f9ab521-986d-4ad8-9c1f-6934e195c15c}");
const SERVICE_NAME = "Anonymously Submits SSL certificates to EFF for security auditing.";
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
INCLUDE('sha256');
INCLUDE('X509ChainWhitelist');
INCLUDE('NSS');

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

  // The url to submit to
  var host=this.prefs.getCharPref("extensions.https_everywhere._observatory.server_host");
  this.submit_url = "https://" + host + "/submit_cert";

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
  if (this.myGetBoolPref("send_asn")) 
    this.setupASNWatcher();

  try {
    NSS.initialize("");
  } catch(e) {
    this.log(WARN, "Failed to initialize NSS component:" + e);
  }
  this.log(DBUG, "Loaded observatory component!");
}

SSLObservatory.prototype = {
  // QueryInterface implementation, e.g. using the generateQI helper
  QueryInterface: XPCOMUtils.generateQI(
    [ CI.nsIObserver,
      CI.nsIProtocolProxyFilter,
      //CI.nsIWifiListener,
      CI.nsIBadCertListener2]),

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

  notifyCertProblem: function(socketInfo, status, targetSite) {
    this.log(NOTE, "cert warning for " + targetSite);
    if (targetSite == "observatory.eff.org") {
      this.log(WARN, "Surpressing observatory warning");
      return true;
    }
    return false;
  },

  setupASNWatcher: function() {
    this.getClientASN();
    this.max_ap = null;

    // we currently do not actually do *any* ASN watching from the client
    // (in other words, the db will not have ASNs for certs submitted 
    // through Tor, even if the user checks the "send ASN" option)
    // all of this code for guessing at changes in our public IP via WiFi hints
    // is therefore disabled
    /*
    // Observe network changes to get new ASNs
    OS.addObserver(this, "network:offline-status-changed", false);
    var pref_service = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefBranchInternal);
    var proxy_branch = pref_service.QueryInterface(Ci.nsIPrefBranchInternal);
    proxy_branch.addObserver("network.proxy", this, false);

    try {
      var wifi_service = Cc["@mozilla.org/wifi/monitor;1"].getService(Ci.nsIWifiMonitor);
      wifi_service.startWatching(this);
    } catch(e) {
      this.log(INFO, "Failed to register ASN change monitor: "+e);
    }*/
  },

  stopASNWatcher: function() {
    this.client_asn = -1;
    /*
    // unhook the observers we registered above
    OS.removeObserver(this, "network:offline-status-changed");
    var pref_service = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefBranchInternal);
    var proxy_branch = pref_service.QueryInterface(Ci.nsIPrefBranchInternal);
    proxy_branch.removeObserver(this, "network.proxy");
    try {
      var wifi_service = Cc["@mozilla.org/wifi/monitor;1"].getService(Ci.nsIWifiMonitor);
      wifi_service.stopWatching(this);
    } catch(e) {
      this.log(WARN, "Failed to stop wifi state monitor: "+e);
    }*/
  },

  getClientASN: function() {
    // Fetch a new client ASN..
    if (!this.myGetBoolPref("send_asn")) {
      this.client_asn = -1;
      return;
    }
    else if (!this.torbutton_installed) {
      this.client_asn = -2;
      return;
    }
    // XXX As a possible base case: the user is running Tor, is not using
    // bridges, and has send_asn enabled: should we ping an eff.org URL to
    // learn our ASN?
    return;
  },

  /*
  // Wifi status listener
  onChange: function(accessPoints) {
    try {
      var max_ap = accessPoints[0].mac;
    } catch(e) {
      return null;  // accessPoints[0] is undefined
    }
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
  */

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

      if (!this.observatoryActive()) return;

      var host_ip = "-1";
      var httpchannelinternal = subject.QueryInterface(Ci.nsIHttpChannelInternal);
      try { 
        host_ip = httpchannelinternal.remoteAddress;
      } catch(e) {
          this.log(WARN, "Could not get host IP address.");
      }
      subject.QueryInterface(Ci.nsIHttpChannel);
      var certchain = this.getSSLCert(subject);
      if (certchain) {
        var chainEnum = certchain.getChain();
        var chainArray = [];
        var chainArrayFpStr = '';
        var fps = [];
        for(var i = 0; i < chainEnum.length; i++) {
          var cert = chainEnum.queryElementAt(i, Ci.nsIX509Cert);
          chainArray.push(cert);
          var fp = (cert.md5Fingerprint+cert.sha1Fingerprint).replace(":", "", "g");
          fps.push(fp);
          chainArrayFpStr = chainArrayFpStr + fp;
        }
        var chain_hash = sha256_digest(chainArrayFpStr).toUpperCase();
        this.log(INFO, "SHA-256 hash of cert chain for "+new String(subject.URI.host)+" is "+ chain_hash);

        if(!this.myGetBoolPref("use_whitelist")) {
          this.log(WARN, "Not using whitelist to filter cert chains.");
        }
        else if (this.isChainWhitelisted(chain_hash)) {
          this.log(INFO, "This cert chain is whitelisted. Not submitting.");
          return;
        }
        else {
          this.log(INFO, "Cert chain is NOT whitelisted. Proceeding with submission.");
        }

        if (subject.URI.port == -1) {
            this.submitChain(chainArray, fps, new String(subject.URI.host), subject, host_ip);
        } else {
            this.submitChain(chainArray, fps, subject.URI.host+":"+subject.URI.port, subject, host_ip);
        }
      }
    }
  },

  observatoryActive: function() {
    if (!this.myGetBoolPref("enabled")) return false;
    if (this.torbutton_installed) {
      // Allow Tor users to choose if they want to submit
      // during tor and/or non-tor
      if (!this.myGetBoolPref("submit_during_tor") && 
           this.prefs.getBoolPref("extensions.torbutton.tor_enabled")) 
        return false;
      if (!this.myGetBoolPref("submit_during_nontor") && 
          !this.prefs.getBoolPref("extensions.torbutton.tor_enabled")) 
        return false;
    } else if (!this.myGetBoolPref("use_custom_proxy")) {
      this.log(DBUG, "No torbutton installed, but no custom proxies either. Not submitting certs");
      return false;
    } else {
      // no torbutton; the custom proxy is probably the user opting to
      // submit certs without strong anonymisation.  Because the
      // anonymisation is weak, we avoid submitting during private browsing
      // mode.
      try {
        var pbs = CC["@mozilla.org/privatebrowsing;1"].getService(CI.nsIPrivateBrowsingService);
        if (pbs.privateBrowsingEnabled) return false;
      } catch (e) { /* seamonkey or old firefox */ }
    }
    return true;
  },

  myGetBoolPref: function(prefstring) {
    // syntactic sugar
    return this.prefs.getBoolPref ("extensions.https_everywhere._observatory." + prefstring);
  },

  isChainWhitelisted: function(chainhash) {
    if (X509ChainWhitelist == null) {
      this.log(WARN, "Could not find whitelist of popular certificate chains, so ignoring whitelist");
      return false;
    }
    if (X509ChainWhitelist[chainhash] != null) {
      return true;
    }
    return false;
  },

  findRootInChain: function(certArray) {
    // Return the position in the chain Array of the/a root CA
    var rootidx = -1;
    var nextInChain = certArray[0].issuer;
    for (var i = 0; i < certArray.length; i++) {
      // Find the next cert in the valid chain
      if (certArray[i].equals(nextInChain)) {
        if (certArray[i].issuerName == certArray[i].subjectName) {
          // All X509 root certs are self-signed
          this.log(INFO, "Got root cert at position: "+i);
          rootidx = i;
          break;
        } else {
          // This is an intermediate CA cert; keep looking for the root
          nextInChain = certArray[i].issuer;
        }
      }
    }
    return rootidx;
  },

  processConvergenceChain: function(chain) {
    // Make sure the chain we're working with is sane, even if Convergence is
    // present
    // Convergence currently performs MITMs against the Firefox in order to
    // get around https://bugzilla.mozilla.org/show_bug.cgi?id=644640.  The
    // end-entity cert produced by Convergence contains a copy of the real
    // end-entity cert inside an X509v3 extension.  For now we submit the
    // synthetic end-entity cert but avoid the root CA cert above it, which would
    // function like a tracking ID.  If anyone knows how to parse X509v3
    // extensions in JS, we should do that instead.
    var convergence = Components.classes['@thoughtcrime.org/convergence;1'];
    if (!convergence) return null;
    convergence = convergence.getService().wrappedJSObject;
    if (!convergence || !convergence.enabled) return null;

    this.log(INFO, "Convergence uses its own root CAs; not submitting those");
    chain.certArray = chain.certArray.slice(0,1);
    chain.fps = chain.fps.slice(0,1);
    
    for (var elem in convergence) {
      this.log(WARN, "Element " + elem)
      this.log(WARN, "Value " + convergence[elem]);

    }
    this.log(WARN, convergence.certificateStatus.getVerificiationStatus(chain.certArray[0]));
    //this.log(WARN, this.extractRealLeafFromConveregenceLeaf(certArray2[0]));
  },

  extractRealLeafFromConveregenceLeaf: function(certificate) {
    var len = {};
    var derEncoding = certificate.getRawDER(len);

    var derItem = NSS.types.SECItem();
    derItem.data = NSS.lib.ubuffer(derEncoding);
    derItem.len = len.value;

    var completeCertificate = NSS.lib.CERT_DecodeDERCertificate(derItem.address(), 1, null);

    var extItem = NSS.types.SECItem();
    var status = NSS.lib.CERT_FindCertExtension(completeCertificate, 
                                                NSS.lib.SEC_OID_NS_CERT_EXT_COMMENT, 
                                                extItem.address());
    if (status != -1) {
      var encoded = '';
      var asArray = ctypes.cast(extItem.data, ctypes.ArrayType(ctypes.unsigned_char, extItem.len).ptr).contents;
      var marker = false;

      for (var i=0;i<asArray.length;i++) {
        if (marker) {
          encoded += String.fromCharCode(asArray[i]);
        } else if (asArray[i] == 0x00) {
          marker = true;
        }
      }

      return JSON.parse(encoded);
    }
  },

  submitChain: function(certArray, fps, domain, channel, host_ip) {
    var base64Certs = [];
    var leaf = certArray[0];
    // Put all this chain data in one object so that it can be modified by
    // subroutines if required
    c = {}; c.certArray=certArray; c.fps = fps;
    var rootidx = this.findRootInChain(c.certArray);

    if (!this.myGetBoolPref("alt_roots")) {
      // Submit self-signed end-entity certs regardless, because these are
      // atypical for confidential private PKI deployments, and they need to
      // be audited in order to warn about most devices with
      // remotely-factorisable key vulnerabilites
      if (!(leaf.issuerName == leaf.subjectName)) {
        if (rootidx == -1) {
          // A cert with an unknown/absent Issuer.  Out of caution, don't submit these
          this.log(INFO, "Cert for " + domain + " issued by unknown CA " +
                   leaf.issuerName + " (not submitting due to settings)");
          return;
        } else if (!(c.fps[rootidx] in this.public_roots)) {
          // A cert with a known but non-public Issuer
          this.log(INFO, "Got a private root cert. Ignoring domain "
                   +domain+" with root "+c.fps[rootidx]);
          return;
        }
      }
    } else {
      this.processConvergenceChain(c);
    }

    if (c.fps[0] in this.already_submitted) {
      this.log(INFO, "Already submitted cert for "+domain+". Ignoring");
      return;
    }

    var wm = CC["@mozilla.org/appshell/window-mediator;1"] 
                .getService(Components.interfaces.nsIWindowMediator);
    var browserWindow = wm.getMostRecentWindow("navigator:browser");
    for (var i = 0; i < c.certArray.length; i++) {
      var len = new Object();
      var derData = c.certArray[i].getRawDER(len);
      //var encoded = browserWindow.btoa(derData);  // seems to not be a real base 64 encoding!
      base64Certs.push(this.base64_encode(derData, false, false));
    }

    var reqParams = [];
    reqParams.push("domain="+domain);
    reqParams.push("server_ip="+host_ip);
    if (this.myGetBoolPref("testing")) {
      reqParams.push("testing=1");
      // The server can compute these, but they're a nice test suite item!
      reqParams.push("fplist="+this.compatJSON.encode(c.fps));
    }
    reqParams.push("certlist="+this.compatJSON.encode(base64Certs));
    // XXX: Should we indicate if this was a wifi-triggered asn fetch vs
    // the less reliable offline/online notification-triggered fetch?
    // this.max_ap will be null if we have no wifi info.
    reqParams.push("client_asn="+this.client_asn);
    if (this.myGetBoolPref("priv_dns"))  reqParams.push("private_opt_in=1") 
    else                                 reqParams.push("private_opt_in=0");

    var params = reqParams.join("&") + "&padding=0";
    var tot_len = BASE_REQ_SIZE;

    this.log(INFO, "Submitting cert for "+domain);
    this.log(DBUG, "submit_cert params: "+params);

    // Pad to exp scale. This is done because the distribution of cert sizes
    // is almost certainly pareto, and definitely not uniform.
    for (tot_len = BASE_REQ_SIZE; tot_len < params.length; tot_len*=2);

    while (params.length != tot_len) {
      params += "0";
    }

    var that = this; // We have neither SSLObservatory nor this in scope in the lambda

      
    var HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                            .getService(Components.interfaces.nsISupports)
                            .wrappedJSObject;
    var win = HTTPSEverywhere.getWindowForChannel(channel);
    var req = this.buildRequest(params);
    req.onreadystatechange = function(evt) {
      if (req.readyState == 4) {
        if (req.status == 200) {
          that.log(INFO, "Successful cert submission");
          if (!that.prefs.getBoolPref("extensions.https_everywhere._observatory.cache_submitted")) {
            if (c.fps[0] in that.already_submitted)
              delete that.already_submitted[c.fps[0]];
          }
        } else if (req.status == 403) {
          that.log(WARN, "The SSL Observatory has issued a warning about this certificate for " + domain);
          try {
            var warningObj = JSON.parse(req.responseText);
            that.warnUser(warningObj, win, c.certArray[0]);
          } catch(e) {
            that.log(WARN, "Failed to process SSL Observatory cert warnings :( " + e);
            that.log(WARN, req.responseText);
          }
        } else {
          if (c.fps[0] in that.already_submitted)
            delete that.already_submitted[c.fps[0]];
          try {
            that.log(WARN, "Cert submission failure "+req.status+": "+req.responseText);
          } catch(e) {
            that.log(WARN, "Cert submission failure and exception: "+e);
          }
        }
      }
    };

    // Cache this here to prevent multiple submissions for all the content elements.
    that.already_submitted[c.fps[0]] = true;
    req.send(params);
  },

  buildRequest: function(params) {
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                 .createInstance(Ci.nsIXMLHttpRequest);

    // We do this again in case the user altered about:config
    var host=this.prefs.getCharPref("extensions.https_everywhere._observatory.server_host");
    this.submit_url = "https://" + host + "/submit_cert";
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
    return req;
  },

  warnUser: function(warningObj, win, cert) {
    var aWin = CC['@mozilla.org/appshell/window-mediator;1']
                 .getService(CI.nsIWindowMediator) 
                 .getMostRecentWindow('navigator:browser');
    aWin.openDialog("chrome://https-everywhere/content/observatory-warning.xul",
                    "","chrome,centerscreen", warningObj, win, cert);
  },


  getProxySettings: function() {
    var proxy_settings = ["direct", "", 0];
    if (this.torbutton_installed && this.myGetBoolPref("use_tor_proxy")) {
      // extract torbutton proxy settings
      proxy_settings[0] = "http";
      proxy_settings[1] = this.prefs.getCharPref("extensions.torbutton.https_proxy");
      proxy_settings[2] = this.prefs.getIntPref("extensions.torbutton.https_port");

      if (proxy_settings[2] == 0) {
        proxy_settings[0] = "socks";
        proxy_settings[1] = this.prefs.getCharPref("extensions.torbutton.socks_host");
        proxy_settings[2] = this.prefs.getIntPref("extensions.torbutton.socks_port");
      }
    } else if (this.myGetBoolPref("use_custom_proxy")) {
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
