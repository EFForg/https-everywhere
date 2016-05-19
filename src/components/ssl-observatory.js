const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const CI = Components.interfaces;
const CC = Components.classes;
const CR = Components.results;

// Log levels
let VERB=1;
let DBUG=2;
let INFO=3;
let NOTE=4;
let WARN=5;

let BASE_REQ_SIZE=4096;
let TIMEOUT = 60000;
let MAX_OUTSTANDING = 20; // Max # submission XHRs in progress
let MAX_DELAYED = 32;     // Max # XHRs are waiting around to be sent or retried 

let ASN_PRIVATE = -1;     // Do not record the ASN this cert was seen on
let ASN_IMPLICIT = -2;    // ASN can be learned from connecting IP
let ASN_UNKNOWABLE = -3;  // Cert was seen in the absence of [trustworthy] Internet access

// XXX: We should make the _observatory tree relative.
let LLVAR="extensions.https_everywhere.LogLevel";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/ctypes.jsm");

// Alias to reduce the number of spurious warnings from amo-validator.
let tcypes = ctypes;

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
    var tor_logger_component = CC["@torproject.org/torbutton-logger;1"];
    if (tor_logger_component) {
      this.tor_logger =
        tor_logger_component.getService(CI.nsISupports).wrappedJSObject;
      this.torbutton_installed = true;
    }
  } catch(e) {
    this.torbutton_installed = false;
  }

  this.HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                            .getService(Components.interfaces.nsISupports)
                            .wrappedJSObject;

  /* The proxy test result starts out null until the test is attempted.
   * This is for UI notification purposes */
  this.proxy_test_successful = null;
  this.proxy_test_callback = null;
  this.cto_url = "https://check.torproject.org/?TorButton=true";
  // a regexp to match the above URL
  this.cto_regexp = RegExp("^https://check\\.torproject\\.org/");

  this.public_roots = root_ca_hashes;

  // Clear these on cookies-cleared observer event
  this.already_submitted = {};
  this.delayed_submissions = {};
  OS.addObserver(this, "cookie-changed", false);

  // Figure out the url to submit to
  this.submit_host = null;
  this.findSubmissionTarget();

  // Used to track current number of pending requests to the server
  this.current_outstanding_requests = 0;

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

  this.client_asn = ASN_PRIVATE;
  if (this.myGetBoolPref("send_asn")) 
    this.setupASNWatcher();

  try {
    NSS.initialize("");
  } catch(e) {
    this.log(WARN, "Failed to initialize NSS component:" + e);
  }

  // It is necessary to testProxySettings after the window is loaded, since the
  // Tor Browser will not be finished establishing a circuit otherwise
  OS.addObserver(this, "browser-delayed-startup-finished", false);

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

  findSubmissionTarget: function() {
    // Compute the URL that the Observatory will currently submit to
    var host = this.myGetCharPref("server_host");
    // Rebuild the regexp iff the host has changed
    if (host != this.submit_host) {
      this.submit_host = host;
      this.submit_url = "https://" + host + "/submit_cert";
      this.submission_regexp = RegExp("^" + this.regExpEscape(this.submit_url));
    }
  },

  regExpEscape: function(s) {
    // Borrowed from the Closure Library,
    // https://closure-library.googlecode.com/svn/docs/closure_goog_string_string.js.source.html
     return String(s).replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, '\\$1').replace(/\x08/g, '\\x08');
  },

  notifyCertProblem: function(socketInfo, status, targetSite) {
    this.log(NOTE, "cert warning for " + targetSite);
    if (targetSite == "observatory.eff.org") {
      this.log(WARN, "Suppressing observatory warning");
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
    this.client_asn = ASN_PRIVATE;
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
      this.client_asn = ASN_PRIVATE;
      return;
    }
    else if (!this.torbutton_installed) {
      this.client_asn = ASN_IMPLICIT;
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

  // Calculate the MD5 fingerprint for a cert. This is the fingerprint of the
  // DER-encoded form, same as the result of
  // openssl x509 -md5 -fingerprint -noout
  // We use this because the SSL Observatory depends in many places on a special
  // fingerprint which is the concatenation of MD5+SHA1, and the MD5 fingerprint
  // is no longer available on the cert object.
  // Implementation cribbed from
  // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsICryptoHash
  md5Fingerprint: function(cert) {
    var len = new Object();
    var derData = cert.getRawDER(len);
    var ch = CC["@mozilla.org/security/hash;1"].createInstance(CI.nsICryptoHash);
    ch.init(ch.MD5);
    ch.update(derData,derData.length);
    var h = ch.finish(false);

    function toHexString(charCode) {
      return ("0" + charCode.toString(16)).slice(-2);
    }

    var hexArr = [];
    for (var i in h){
      hexArr.push(toHexString(h.charCodeAt(i)));
    }
    return hexArr.join("").toUpperCase();
  },

  ourFingerprint: function(cert) {
    // Calculate our custom fingerprint from an nsIX509Cert
    return (this.md5Fingerprint(cert)+cert.sha1Fingerprint).replace(":", "", "g");
  },

  observe: function(subject, topic, data) {
    if (topic == "cookie-changed" && data == "cleared") {
      this.already_submitted = {};
      this.delayed_submissions = {};
      this.log(INFO, "Cookies were cleared. Purging list of pending and already submitted certs");
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
        this.log(INFO, "Could not get server IP address.");
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
          var fp = this.ourFingerprint(cert);
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
          this.submitChain(chainArray, fps, new String(subject.URI.host), subject, host_ip, false);
        } else {
          this.submitChain(chainArray, fps, subject.URI.host+":"+subject.URI.port, subject, host_ip, false);
        }
      }
    }

    if (topic == "browser-delayed-startup-finished") {
      this.testProxySettings();
    }
  },

  observatoryActive: function() {

    if (!this.myGetBoolPref("enabled"))
      return false;

    if (this.torbutton_installed && this.proxy_test_successful) {
      // Allow Tor users to choose if they want to submit
      // during tor and/or non-tor
      if (this.myGetBoolPref("submit_during_tor") && 
           this.prefs.getBoolPref("extensions.torbutton.tor_enabled")) 
        return true;

      if (this.myGetBoolPref("submit_during_nontor") && 
          !this.prefs.getBoolPref("extensions.torbutton.tor_enabled")) 
        return true;

      return false;
    }

    if (this.proxy_test_successful) {
      return true;
    } else if (this.myGetBoolPref("use_custom_proxy")) {
      // no torbutton; the custom proxy is probably the user opting to
      // submit certs without strong anonymisation.  Because the
      // anonymisation is weak, we avoid submitting during private browsing
      // mode.
      try {
        var pbs = CC["@mozilla.org/privatebrowsing;1"].getService(CI.nsIPrivateBrowsingService);
        if (pbs.privateBrowsingEnabled) return false;
      } catch (e) { /* seamonkey or old firefox */ }

      return true;
    }

    return false;
  },

  // following two methods are syntactic sugar
  myGetBoolPref: function(prefstring) {
    return this.prefs.getBoolPref ("extensions.https_everywhere._observatory." + prefstring);
  },

  myGetCharPref: function(prefstring) {
    return this.prefs.getCharPref ("extensions.https_everywhere._observatory." + prefstring);
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
    // present.

    // Convergence currently performs MITMs against the Firefox in order to
    // get around https://bugzilla.mozilla.org/show_bug.cgi?id=644640.  The
    // end-entity cert produced by Convergence contains a copy of the real
    // end-entity cert inside an X509v3 extension.  We extract this and send
    // it rather than the Convergence certs.
    var convergence = Components.classes['@thoughtcrime.org/convergence;1'];
    if (!convergence) return null;
    convergence = convergence.getService().wrappedJSObject;
    if (!convergence || !convergence.enabled) return null;

    this.log(INFO, "Convergence uses its own internal root certs; not submitting those");

    //this.log(WARN, convergence.certificateStatus.getVerificiationStatus(chain.certArray[0]));
    try {
      var certInfo = this.extractRealLeafFromConveregenceLeaf(chain.certArray[0]);
      var b64Cert = certInfo["certificate"];
      var certDB = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);
      chain.leaf = certDB.constructX509FromBase64(b64Cert);
      chain.certArray = [chain.leaf];
      chain.fps = [this.ourFingerprint(chain.leaf)];
    } catch (e) {
      this.log(WARN, "Failed to extract leaf cert from Convergence cert " + e);
      chain.certArray = chain.certArray.slice(0,1);
      chain.fps = chain.fps.slice(0,1);
    }

  },

  extractRealLeafFromConveregenceLeaf: function(certificate) {
    // Copied from Convergence's CertificateStatus.getVerificiationStatus
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
      var asArray = tcypes.cast(extItem.data, tcypes.ArrayType(tcypes.unsigned_char, extItem.len).ptr).contents;
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

  shouldSubmit: function(chain, domain) {
    // Return true if we should submit this chain to the SSL Observatory
    var rootidx = this.findRootInChain(chain.certArray);
    var ss= false;

    if (chain.leaf.issuerName == chain.leaf.subjectName) 
      ss = true;

    if (!this.myGetBoolPref("self_signed") && ss) {
      this.log(INFO, "Not submitting self-signed cert for " + domain);
      return false;
    }

    if (!ss && !this.myGetBoolPref("alt_roots")) {
      if (rootidx == -1) {
        // A cert with an unknown/absent Issuer.  Out of caution, don't submit these
        this.log(INFO, "Cert for " + domain + " issued by unknown CA " +
                 chain.leaf.issuerName + " (not submitting due to settings)");
        return false;
      } else if (!(chain.fps[rootidx] in this.public_roots)) {
        // A cert with a known but non-public Issuer
        this.log(INFO, "Got a private root cert. Ignoring domain "
                 +domain+" with root "+chain.fps[rootidx]);
        return false;
      }
    }

    if (chain.fps[0] in this.already_submitted) {
      this.log(INFO, "Already submitted cert for "+domain+". Ignoring");
      return false;
    }
    return true;
  },

  submitChain: function(certArray, fps, domain, channel, host_ip, resubmitting) {
    var base64Certs = [];
    // Put all this chain data in one object so that it can be modified by
    // subroutines if required
    var c = {}; c.certArray = certArray; c.fps = fps; c.leaf = certArray[0];
    this.processConvergenceChain(c);
    if (!this.shouldSubmit(c,domain)) return;

    // only try to submit now if there aren't too many outstanding requests
    if (this.current_outstanding_requests > MAX_OUTSTANDING) {
      this.log(WARN, "Too many outstanding requests ("+this.current_outstanding_requests+"), not submitting");

      // if there are too many current requests but not too many
      // delayed/pending ones, then delay this one
      if (Object.keys(this.delayed_submissions).length < MAX_DELAYED)
        if (!(c.fps[0] in this.delayed_submissions)) {
          this.log(WARN, "Planning to retry submission...");
          let retry = function() { this.submitChain(certArray, fps, domain, channel, host_ip, true); };
          this.delayed_submissions[c.fps[0]] = retry;
        }
      return;
    }

    for (var i = 0; i < c.certArray.length; i++) {
      var len = new Object();
      var derData = c.certArray[i].getRawDER(len);
      let result = "";
      for (let j = 0, dataLength = derData.length; j < dataLength; ++j) 
        result += String.fromCharCode(derData[j]);
      base64Certs.push(btoa(result));
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

    if (resubmitting) {
      reqParams.push("client_asn="+ASN_UNKNOWABLE);
    }
    else {
      reqParams.push("client_asn="+this.client_asn);
    }

    if (this.myGetBoolPref("priv_dns")) {
      reqParams.push("private_opt_in=1");
    }
    else {
      reqParams.push("private_opt_in=0");
    }

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
    var win = null;
    if (channel) {
      var browser = this.HTTPSEverywhere.getBrowserForChannel(channel);
      if (browser) {
        var win = browser.contentWindow;
      }
    }
    var req = this.buildRequest(params);
    req.timeout = TIMEOUT;

    req.onreadystatechange = function(evt) {
      if (req.readyState == 4) {
        // pop off one outstanding request
        that.current_outstanding_requests -= 1;
        that.log(DBUG, "Popping one off of outstanding requests, current num is: "+that.current_outstanding_requests);

        if (req.status == 200) {
          that.log(INFO, "Successful cert submission");
          if (!that.prefs.getBoolPref("extensions.https_everywhere._observatory.cache_submitted") &&
              c.fps[0] in that.already_submitted) {
            delete that.already_submitted[c.fps[0]];
          }

          // Retry up to two previously failed submissions
          let n = 0;
          for (let fp in that.delayed_submissions) {
            that.log(WARN, "Retrying a submission...");
            that.delayed_submissions[fp]();
            delete that.delayed_submissions[fp];
            if (++n >= 2) break;
          }
        } else if (req.status == 403) {
          that.log(WARN, "The SSL Observatory has issued a warning about this certificate for " + domain);
          try {
            var warningObj = JSON.parse(req.responseText);
            if (win) that.warnUser(warningObj, win, c.certArray[0]);
          } catch(e) {
            that.log(WARN, "Failed to process SSL Observatory cert warnings :( " + e);
            that.log(WARN, req.responseText);
          }
        } else {
          // Submission failed
          if (c.fps[0] in that.already_submitted) {
            delete that.already_submitted[c.fps[0]];
          }
          try {
            that.log(WARN, "Cert submission failure "+req.status+": "+req.responseText);
          } catch(e) {
            that.log(WARN, "Cert submission failure and exception: "+e);
          }
          // If we don't have too many delayed submissions, and this isn't
          // (somehow?) one of them, then plan to retry this submission later
          if (Object.keys(that.delayed_submissions).length < MAX_DELAYED &&
              c.fps[0] in that.delayed_submissions) {
            that.log(WARN, "Planning to retry submission...");
            let retry = function() { that.submitChain(certArray, fps, domain, channel, host_ip, true); };
            that.delayed_submissions[c.fps[0]] = retry;
          }
        }
      }
    };

    // Cache this here to prevent multiple submissions for all the content elements.
    that.already_submitted[c.fps[0]] = true;

    // add one to current outstanding request number
    that.current_outstanding_requests += 1;
    that.log(DBUG, "Adding outstanding request, current num is: "+that.current_outstanding_requests);
    req.send(params);
  },

  buildRequest: function(params) {
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                 .createInstance(Ci.nsIXMLHttpRequest);

    // We do this again in case the user altered about:config
    this.findSubmissionTarget();
    req.open("POST", this.submit_url+this.csrf_nonce, true);

    // Send the proper header information along with the request
    // Do not set gzip header.. It will ruin the padding
    req.setRequestHeader("X-Privacy-Info", "EFF SSL Observatory: https://www.eff.org/r.22c");
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

  registerProxyTestNotification: function(callback_fcn) {
    if (this.proxy_test_successful != null) {
      /* Proxy test already ran. Callback immediately. */
      callback_fcn(this.proxy_test_successful);
      this.proxy_test_callback = null;
      return;
    } else {
      this.proxy_test_callback = callback_fcn;
    }
  },

  testProxySettings: function() {
    /* Plan:
     * 1. Launch an async XMLHttpRequest to check.tp.o with magic nonce
     * 3. Filter the nonce in protocolProxyFilter to use proxy settings
     * 4. Async result function sets test result status based on check.tp.o
     */
    this.proxy_test_successful = null;

    if (this.getProxySettings().tor_safe == false) {
      this.proxy_test_successful = false;
      this.log(INFO, "Tor check failed: Not safe to check.");
      return;
    }

    try {
      var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                              .createInstance(Components.interfaces.nsIXMLHttpRequest);
      var url = this.cto_url + this.csrf_nonce;
      req.open('GET', url, true);
      req.channel.loadFlags |= Ci.nsIRequest.LOAD_BYPASS_CACHE;
      req.overrideMimeType("text/xml");
      var that = this; // Scope gymnastics for async callback
      req.onreadystatechange = function (oEvent) {
        if (req.readyState === 4) {
          that.proxy_test_successful = false;

          if(req.status == 200) {
            if(!req.responseXML) {
              that.log(INFO, "Tor check failed: No XML returned by check service.");
              return;
            }

            var result = req.responseXML.getElementById('TorCheckResult');
            if(result===null) {
              that.log(INFO, "Tor check failed: Non-XML returned by check service.");
            } else if(typeof(result.target) == 'undefined' 
                    || result.target === null) {
              that.log(INFO, "Tor check failed: Busted XML returned by check service.");
            } else if(result.target === "success") {
              that.log(INFO, "Tor check succeeded.");
              that.proxy_test_successful = true;
            } else {
              that.log(INFO, "Tor check failed: "+result.target);
            }
          } else {
            that.log(INFO, "Tor check failed: HTTP Error "+req.status);
          }

          /* Notify the UI of the test result */
          if (that.proxy_test_callback) {
            that.proxy_test_callback(that.proxy_test_successful);
            that.proxy_test_callback = null;
          }
        }
      };
      req.send(null);
    } catch(e) {
      this.proxy_test_successful = false;
      if(e.result == 0x80004005) { // NS_ERROR_FAILURE
        this.log(INFO, "Tor check failed: Proxy not running.");
      }
      this.log(INFO, "Tor check failed: Internal error: "+e);
      if (this.proxy_test_callback) {
        this.proxy_test_callback(this.proxy_test_successful);
        this.proxy_test_callback = null;
      }
    }
  },

  getProxySettings: function(testingForTor) {
    // This may be called either for an Observatory submission, or during a test to see if Tor is
    // present.  The testingForTor argument is true in the latter case.
    var proxy_settings = {
      type: "direct",
      host: "",
      port: 0,
      tor_safe: false
    };
    this.log(INFO,"in getProxySettings()");
    var custom_proxy_type = this.myGetCharPref("proxy_type");
    if (this.torbutton_installed && this.myGetBoolPref("use_tor_proxy")) {
      this.log(INFO,"CASE: use_tor_proxy");
      // extract torbutton proxy settings
      proxy_settings.type = "http";
      proxy_settings.host = this.prefs.getCharPref("extensions.torbutton.https_proxy");
      proxy_settings.port = this.prefs.getIntPref("extensions.torbutton.https_port");

      if (proxy_settings.port == 0) {
        proxy_settings.type = "socks";
        proxy_settings.host = this.prefs.getCharPref("extensions.torbutton.socks_host");
        proxy_settings.port = this.prefs.getIntPref("extensions.torbutton.socks_port");
      }
      proxy_settings.tor_safe = true;
    /* Regarding the test below:
     *
     * custom_proxy_type == "direct" is indicative of the user having selected "submit certs even if
     * Tor is not available", rather than true custom Tor proxy settings.  So in that case, there's
     * not much point probing to see if the direct proxy is actually a Tor connection, and
     * localhost:9050 is a better bet.  People whose networks send all traffic through Tor can just
     * tell the Observatory to submit certs without Tor.
     */
    } else if (this.myGetBoolPref("use_custom_proxy") && !(testingForTor && custom_proxy_type == "direct")) {
      this.log(INFO,"CASE: use_custom_proxy");
      proxy_settings.type = custom_proxy_type;
      proxy_settings.host = this.myGetCharPref("proxy_host");
      proxy_settings.port = this.prefs.getIntPref("extensions.https_everywhere._observatory.proxy_port");
      proxy_settings.tor_safe = false;
    } else {
      /* Take a guess at default tor proxy settings */
      this.log(INFO,"CASE: try localhost:9050");
      proxy_settings.type = "socks";
      proxy_settings.host = "localhost";
      proxy_settings.port = 9050;
      proxy_settings.tor_safe = true;
    }
    this.log(INFO, "Using proxy: " + proxy_settings);
    return proxy_settings;
  },

  applyFilter: function(aProxyService, inURI, aProxy) {

    try {
      if (inURI instanceof Ci.nsIURI) {
        var aURI = inURI.QueryInterface(Ci.nsIURI);
        if (!aURI) this.log(WARN, "Failed to QI to nsIURI!");
      } else {
        this.log(WARN, "applyFilter called without URI");
      }
    } catch (e) {
      this.log(WARN, "EXPLOSION: " + e);
    }

    var isSubmission = this.submission_regexp.test(aURI.spec);
    var testingForTor = this.cto_regexp.test(aURI.spec);

    if (isSubmission || testingForTor) {
      if (aURI.path.search(this.csrf_nonce+"$") != -1) {

        this.log(INFO, "Got observatory url + nonce: "+aURI.spec);
        var proxy_settings = null;
        var proxy = null;

        // Send it through tor by creating an nsIProxy instance
        // for the torbutton proxy settings.
        try {
          proxy_settings = this.getProxySettings(testingForTor);
          proxy = this.pps.newProxyInfo(
            proxy_settings.type,
            proxy_settings.host,
            proxy_settings.port,
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
    }
    return aProxy;
  },

  // [optional] an array of categories to register this component in.
  // Hack to cause us to get instantiate early
  _xpcom_categories: [ { category: "profile-after-change" }, ],

  encString: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  encStringS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',

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
      var levelName = ["", "VERB", "DBUG", "INFO", "NOTE", "WARN"][level];
      var prefix = "SSL Observatory " + levelName + ": ";
      // dump() prints to browser stdout. That's sometimes undesirable,
      // so only do it when a pref is set (running from test.sh enables
      // this pref).
      if (this.prefs.getBoolPref("extensions.https_everywhere.log_to_stdout")) {
        dump(prefix + str + "\n");
      }
      econsole.logStringMessage(prefix + str);
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
