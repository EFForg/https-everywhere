// XXX: This service uses prefs we have not set defaults for yet.
// We should begin including a defaults/preferences/preferences.js
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

// XXX: We should make the _observatory_prefs tree relative.
LLVAR="extensions.https_everywhere.LogLevel";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const OS = Cc['@mozilla.org/observer-service;1'].getService(CI.nsIObserverService);

const SERVICE_CTRID = "@eff.org/ssl-observatory;1";
const SERVICE_ID=Components.ID("{0f9ab521-986d-4ad8-9c1f-6934e195c15c}");
const SERVICE_NAME = "Anonymously Submits strange SSL certificates to EFF.";

function SSLObservatory() {
  this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

  dump("Dump: Loaded observatory component\n");
  this.log(DBUG, "Loaded observatory component!");

  try {
    // Check for torbutton
    this.tor_logger = Components.classes["@torproject.org/torbutton-logger;1"]
          .getService(Components.interfaces.nsISupports).wrappedJSObject;

    this.torbutton_installed = true;

    // If the user wants to use their Tor proxy, grab it automatically
    if (this.prefs.getBoolPref("extensions.https_everywhere._prefs.use_tor_proxy")) {
      // extract torbutton proxy settings
      this.proxy_port = this.prefs.getIntPref("extensions.torbutton.https_port");
      this.proxy_host = this.prefs.getCharPref("extensions.torbutton.https_proxy");
      this.proxy_type = "http";

      if (!this.proxy_port) {
        this.proxy_host = this.prefs.getCharPref("extensions.torbutton.socks_host");
        this.proxy_port = this.prefs.getIntPref("extensions.torbutton.socks_port");
        this.proxy_type = "socks";
      }
    }
  } catch(e) {
    dump("Torbutton not found\n");
    this.torbutton_installed = false;
  }

  if (this.prefs.getBoolPref("extensions.https_everywhere._observatory_prefs.use_custom_proxy")) {
    this.proxy_host = this.prefs.getCharPref("extensions.https_everywhere._observatory_prefs.proxy_host");
    this.proxy_port = this.prefs.getIntPref("extensions.https_everywhere._observatory_prefs.proxy_port");
    this.proxy_type = this.prefs.getCharPref("extensions.https_everywhere._observatory_prefs.proxy_type");
  }

  // Generate nonce for request
  this.csrf_nonce = "#"+Math.random().toString()+Math.random().toString();

  // Register observer
  OS.addObserver(this, "http-on-examine-response", false);

  // Register protocolproxyfilter
  var pps = Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
                    .getService(Components.interfaces.nsIProtocolProxyService);

  pps.registerFilter(this, 0);
  this.wrappedJSObject = this;
}

SSLObservatory.prototype = {
  // QueryInterface implementation, e.g. using the generateQI helper
  QueryInterface: XPCOMUtils.generateQI(
    [ Components.interfaces.nsIObserver,
      Components.interfaces.nsIProtocolProxyFilter ]),

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

  observe: function(subject, topic, data) {
   if (this.torbutton_installed) {
     // Allow Tor users to choose if they want to submit
     // during tor and/or non-tor
     if (!this.prefs.getBoolPref("extensions.https_everywhere._observatory_prefs.submit_during_tor")
         && this.prefs.getBoolPref("extensions.torbutton.tor_enabled")) {
       return;
     }
     if (!this.prefs.getBoolPref("extensions.https_everywhere._observatory_prefs.submit_during_nontor")
         && !this.prefs.getBoolPref("extensions.torbutton.tor_enabled")) {
       return;
     }
   }

   if ("http-on-examine-response" == topic) {
     subject.QueryInterface(Ci.nsIHttpChannel);
     var certchain = this.getSSLCert(subject);
     if(certchain) {
       var chainArray = certchain.getChain();

       dump("----------------------------------\n");

       for(var i = 0; i < chainArray.length; i++) {
         var cert = chainArray.queryElementAt(i, Ci.nsIX509Cert);
         var fp = cert.md5Fingerprint +":"+cert.sha1Fingerprint;
         var len = new Object();
         var derData = cert.getRawDER(len);
         dump("DerData: "+this.base64_encode(derData, false, false)+"\n");

         // XXX: Use an async XMLHTTPRequest:
         // XXX: Ask to submit cert
         // XXX: AS number??
       }
       dump("----------------------------------\n");
     }
   }
  },

  applyFilter: function(aProxyService, aURI, aProxy) {
    // XXX: This check may be wrong. Have not tested it
    if (aURI.spec.search("^https://observatory.eff.org/submit.py") != -1 &&
        aURI.path.search(this.csrf_nonce+"$") != -1) {

      // Send it through tor by creating an nsIProxy instance
      // for the torbutton proxy settings.
      var proxy = this.pps.newProxyInfo(this.proxy_type, this.proxy_host,
                  this.proxy_port,
                  Ci.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST,
                  0xFFFFFFFF, null);

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
    var econsole = Components.classes["@mozilla.org/consoleservice;1"]
      .getService(Components.interfaces.nsIConsoleService);
    try {
      var threshold = this.prefs.getIntPref(LLVAR);
    } catch (e) {
      econsole.logStringMessage( "SSL Observatory: Failed to read about:config LogLevel");
      threshold = WARN;
    }
    if (level >= threshold) {
      dump(str+"\n");
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
