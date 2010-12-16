const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const OS = Cc['@mozilla.org/observer-service;1'].getService(CI.nsIObserverService);

const SERVICE_CTRID = "@eff.org/ssl-observatory;1";
const SERVICE_ID=Components.ID("{0f9ab521-986d-4ad8-9c1f-6934e195c15c}");
const SERVICE_NAME = "Anonymously Submits strange SSL certificates to EFF.";

function SSLObservatory() {
  // XXX: Check prefs and save to boolean values
  //      1. use_tor
  //      2. use_nontor
  //      3. submit_private_certs

  try {
    // Check for torbutton
    this.logger = Components.classes["@torproject.org/torbutton-logger;1"]
          .getService(Components.interfaces.nsISupports).wrappedJSObject;
    this.torbutton_installed = true;
    // XXX: We probably want to run the full test of tor functionality here
    // but that involves a https request to check.torproject.org, so we shouldn't
    // do it every time... Or maybe we should?
  } catch(e) {
    dump("Torbutton not found\n");
    this.torbutton_installed = false;
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
        if (!channel instanceof  Ci.nsIChannel) {
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
   if ("http-on-examine-response" == topic) {
     aSubject.QueryInterface(Ci.nsIHttpChannel);
     cert = this.getSSLCert(aSubject);
   }
  },

  applyFilter(aProxyService, aURI, aProxy) {
    // XXX: This check may be wrong. Have not tested it
    if (aURI.spec.search("^https://observatory.eff.org/submit.py") != -1 &&
        aURI.path.search(this.nonce+"$") != -1) {
      // This is for us!
      // XXX: Send it through tor by creating an nsIProxy instance
      // for the torbutton proxy settings.
    }
  },

  // [optional] an array of categories to register this component in.
  // Hack to cause us to get instantiate early
  _xpcom_categories: [ { category: "profile-after-change" }, ],

};

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([SSLObservatory]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([SSLObservatory]);
