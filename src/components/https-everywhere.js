// LOG LEVELS ---

VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

//---------------

https_domains = {};              // maps domain patterns (with at most one
                                 // wildcard) to RuleSets

https_everywhere_blacklist = {}; // URLs we've given up on rewriting because
                                 // of redirection loops

//
const CI = Components.interfaces;
const CC = Components.classes;
const CU = Components.utils;
const CR = Components.results;

const CP_SHOULDPROCESS = 4;

const SERVICE_CTRID = "@eff.org/https-everywhere;1";
const SERVICE_ID=Components.ID("{32c165b4-fe5e-4964-9250-603c410631b4}");
const SERVICE_NAME = "Encrypts your communications with a number of major websites";

const LLVAR = "LogLevel";

const IOS = CC["@mozilla.org/network/io-service;1"].getService(CI.nsIIOService);
const OS = CC['@mozilla.org/observer-service;1'].getService(CI.nsIObserverService);
const LOADER = CC["@mozilla.org/moz/jssubscript-loader;1"].getService(CI.mozIJSSubScriptLoader);
const _INCLUDED = {};

// NoScript uses this blob to include js constructs that stored in the chrome/
// directory, but are not attached to the Firefox UI (normally, js located
// there is attached to an Overlay and therefore is part of the UI).

// Reasons for this: things in components/ directory cannot be split into
// separate files; things in chrome/ can be

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

const WP_STATE_START = CI.nsIWebProgressListener.STATE_START;
const WP_STATE_STOP = CI.nsIWebProgressListener.STATE_STOP;
const WP_STATE_DOC = CI.nsIWebProgressListener.STATE_IS_DOCUMENT;
const WP_STATE_START_DOC = WP_STATE_START | WP_STATE_DOC;
const WP_STATE_RESTORING = CI.nsIWebProgressListener.STATE_RESTORING;

const LF_VALIDATE_ALWAYS = CI.nsIRequest.VALIDATE_ALWAYS;
const LF_LOAD_BYPASS_ALL_CACHES = CI.nsIRequest.LOAD_BYPASS_CACHE | CI.nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE;

const NS_OK = 0;
const NS_BINDING_ABORTED = 0x804b0002;
const NS_BINDING_REDIRECTED = 0x804b0003;
const NS_ERROR_UNKNOWN_HOST = 0x804b001e;
const NS_ERROR_REDIRECT_LOOP = 0x804b001f;
const NS_ERROR_CONNECTION_REFUSED = 0x804b000e;
const NS_ERROR_NOT_AVAILABLE = 0x804b0111;

const LOG_CONTENT_BLOCK = 1;
const LOG_CONTENT_CALL = 2;
const LOG_CONTENT_INTERCEPT = 4;
const LOG_CHROME_WIN = 8;
const LOG_XSS_FILTER = 16;
const LOG_INJECTION_CHECK = 32;
const LOG_DOM = 64;
const LOG_JS = 128;
const LOG_LEAKS = 1024;
const LOG_SNIFF = 2048;
const LOG_CLEARCLICK = 4096;
const LOG_ABE = 8192;

const HTML_NS = "http://www.w3.org/1999/xhtml";

const WHERE_UNTRUSTED = 1;
const WHERE_TRUSTED = 2;
const ANYWHERE = 3;

const DUMMYOBJ = {};

const EARLY_VERSION_CHECK = !("nsISessionStore" in CI && typeof(/ /) === "object");

const OBSERVER_TOPIC_URI_REWRITE = "https-everywhere-uri-rewrite";

function xpcom_generateQI(iids) {
  var checks = [];
  for each (var iid in iids) {
    checks.push("CI." + iid.name + ".equals(iid)");
  }
  var src = checks.length
    ? "if (" + checks.join(" || ") + ") return this;\n"
    : "";
  return new Function("iid", src + "throw Components.results.NS_ERROR_NO_INTERFACE;");
}

function xpcom_checkInterfaces(iid,iids,ex) {
  for (var j = iids.length; j-- >0;) {
    if (iid.equals(iids[j])) return true;
  }
  throw ex;
}

INCLUDE('IOUtil', 'HTTPSRules', 'HTTPS', 'Thread');

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function HTTPSEverywhere() {

  // Set up logging in each component:
  HTTPS.log = HTTPSRules.log = RuleWriter.log = this.log = https_everywhereLog;

  this.log = https_everywhereLog;
  this.wrappedJSObject = this;
  this.https_rules = HTTPSRules;

  // We need to use observers instead of categories for FF3.0 for these:
  // https://developer.mozilla.org/en/Observer_Notifications
  // https://developer.mozilla.org/en/nsIObserverService.
  // https://developer.mozilla.org/en/nsIObserver
  // We also use the observer service to let other extensions know about URIs
  // we rewrite.
  this.obsService = CC["@mozilla.org/observer-service;1"]
                    .getService(Components.interfaces.nsIObserverService);
  this.obsService.addObserver(this, "profile-before-change", false);
  this.obsService.addObserver(this, "profile-after-change", false);
  return;
}

// This defines for Mozilla what stuff HTTPSEverywhere will implement.

// We need to use both ContentPolicy and Observer, because there are some
// things, such as Favicons, who don't get caught by ContentPolicy; we don't
// yet know why we don't just use the observer :/

// ChannelEventSink seems to be necessary in order to handle redirects (eg
// HTTP redirects) correctly.

HTTPSEverywhere.prototype = {
  // properties required for XPCOM registration:
  classDescription: SERVICE_NAME,
  classID:          SERVICE_ID,
  contractID:       SERVICE_CTRID,

  _xpcom_factory: {
    createInstance: function (outer, iid) {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      if (!HTTPSEverywhere.instance)
        HTTPSEverywhere.instance = new HTTPSEverywhere();
      return HTTPSEverywhere.instance.QueryInterface(iid);
    },

    QueryInterface: XPCOMUtils.generateQI(
      [ Components.interfaces.nsISupports,
        Components.interfaces.nsIModule,
        Components.interfaces.nsIFactory ])
  },

  // [optional] an array of categories to register this component in.
  _xpcom_categories: [
    {
      category: "app-startup",
    },
    {
      category: "content-policy",
    },
  ],

  // QueryInterface implementation, e.g. using the generateQI helper
  QueryInterface: XPCOMUtils.generateQI(
    [ Components.interfaces.nsIObserver,
      Components.interfaces.nsIMyInterface,
      Components.interfaces.nsISupports,
      Components.interfaces.nsIContentPolicy,
      Components.interfaces.nsISupportsWeakReference,
      Components.interfaces.nsIWebProgressListener,
      Components.interfaces.nsIWebProgressListener2,
      Components.interfaces.nsIChannelEventSink ]),

  wrappedJSObject: null,  // Initialized by constructor

  getWeakReference: function () {
    return Components.utils.getWeakReference(this);
  },

  // This function is registered solely to detect favicon loads by virtue
  // of their failure to pass through this function.
  onStateChange: function(wp, req, stateFlags, status) {
    if (stateFlags & WP_STATE_START) {
      if (req instanceof CI.nsIChannel) {
        if (req instanceof CI.nsIHttpChannel) {
          PolicyState.attach(req);
        }
      }
    }
  },

  observe: function(subject, topic, data) {
    // Top level glue for the nsIObserver API
    var channel = subject;
    this.log(VERB,"Got observer topic: "+topic);

    if (topic == "http-on-modify-request") {
      if (!(channel instanceof CI.nsIHttpChannel)) return;
      this.log(DBUG,"Got http-on-modify-request: "+channel.URI.spec);
      if (channel.URI.spec in https_everywhere_blacklist) {
        this.log(DBUG, "Avoiding blacklisted " + channel.URI.spec);
        return;
      }
      HTTPS.forceChannel(channel);
    } else if (topic == "http-on-examine-response") {
      this.log(DBUG, "Got http-on-examine-response ");
      HTTPS.handleSecureCookies(channel);
    } else if (topic == "http-on-examine-merged-response") {
      this.log(DBUG, "Got http-on-examine-merged-response ");
      HTTPS.handleSecureCookies(channel);
    } else if (topic == "app-startup") {
      this.log(DBUG,"Got app-startup");
    } else if (topic == "profile-before-change") {
      this.log(INFO, "Got profile-before-change");
      var catman = Components.classes["@mozilla.org/categorymanager;1"]
           .getService(Components.interfaces.nsICategoryManager);
      catman.deleteCategoryEntry("net-channel-event-sinks", SERVICE_CTRID, true);
      Thread.hostRunning = false;
    } else if (topic == "profile-after-change") {
      this.log(DBUG, "Got profile-after-change");
      OS.addObserver(this, "http-on-modify-request", false);
      OS.addObserver(this, "http-on-examine-merged-response", false);
      OS.addObserver(this, "http-on-examine-response", false);
      var dls = CC['@mozilla.org/docloaderservice;1']
        .getService(CI.nsIWebProgress);
      dls.addProgressListener(this, CI.nsIWebProgress.NOTIFY_STATE_REQUEST);
      this.log(INFO,"ChannelReplacement.supported = "+ChannelReplacement.supported);
      HTTPSRules.init();
      Thread.hostRunning = true;
      var catman = Components.classes["@mozilla.org/categorymanager;1"]
           .getService(Components.interfaces.nsICategoryManager);
      // hook on redirections (non persistent, otherwise crashes on 1.8.x)
      catman.addCategoryEntry("net-channel-event-sinks", SERVICE_CTRID,
          SERVICE_CTRID, false, true);
    }
    return;
  },

  // nsIChannelEventSink implementation
  onChannelRedirect: function(oldChannel, newChannel, flags) {
    const uri = newChannel.URI;
    this.log(DBUG,"Got onChannelRedirect.");
    if (!(newChannel instanceof CI.nsIHttpChannel)) {
      this.log(DBUG, newChannel + " is not an instance of nsIHttpChannel");
      return;
    }

    HTTPS.replaceChannel(newChannel);

//    if (HTTPS.forceURI(uri.clone())) {
//      if (!HTTPS.replaceChannel(newChannel)) {
//        // Failed, try to put things back...
//        this.log(DBUG, "reverting URI, " + oldChannel.URI.spec);
//        try {
//          oldChannel.URI.scheme = "http";
//          newChannel.URI.scheme = "http";
//        } catch (e) {
//          this.log(WARN, "uri windback error " + e);
//        }
//      }
//    }
  },

  asyncOnChannelRedirect: function(oldChannel, newChannel, flags, callback) {
    this.onChannelRedirect(oldChannel, newChannel, flags);
    callback.onRedirectVerifyCallback(0);
  },

  // These implement the nsIContentPolicy API; they allow both yes/no answers
  // to "should this load?", but also allow us to change the thing.

  shouldLoad: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeTypeGuess, aInternalCall) {
    if (aContentType == 11) {
      try {
        this.log(DBUG, "shouldLoad: "+aContentLocation.spec);
      } catch(e) {
        this.log(DBUG,"shouldLoad exception");
      }
    }
    var unwrappedLocation = IOUtil.unwrapURL(aContentLocation);
    var scheme = unwrappedLocation.scheme;
    var isHTTP = /^https?$/.test(scheme);   // s? -> either http or https
    if (isHTTP)
      HTTPS.forceURI(aContentLocation, null, aContext);
    return true;
  },

  shouldProcess: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeType, aExtra) {
    return this.shouldLoad(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeType, CP_SHOULDPROCESS);
  },

  get_prefs: function() {
      // get our preferences branch object
      // FIXME: Ugly hack stolen from https
      var branch_name = "extensions.https_everywhere.";
      var o_prefs = false;
      var o_branch = false;
      // this function needs to be called from inside https_everywhereLog, so
      // it needs to do its own logging...
      var econsole = Components.classes["@mozilla.org/consoleservice;1"]
          .getService(Components.interfaces.nsIConsoleService);

      o_prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService);

      if (!o_prefs)
      {
          econsole.logStringMessage("HTTPS Everywhere: Failed to get preferences-service!");
          return false;
      }

      o_branch = o_prefs.getBranch(branch_name);
      if (!o_branch)
      {
          econsole.logStringMessage("HTTPS Everywhere: Failed to get prefs branch!");
          return false;
      }

      // make sure there's an entry for our log level
      try {
        o_branch.getIntPref(LLVAR);
      } catch (e) {
        econsole.logStringMessage("Creating new about:config https_everywhere.LogLevel variable");
        o_branch.setIntPref(LLVAR, WARN);
      }

      return o_branch;
  },

  /**
   * Notify observers of the topic OBSERVER_TOPIC_URI_REWRITE.
   *
   * @param nsIURI oldURI
   * @param string newSpec
   */
  notifyObservers: function(oldURI, newSpec) {
    this.log(INFO, "Notifying observers of rewrite from " + oldURI.spec + " to " + newSpec);
    try {
      // The subject has to be an nsISupports and the extra data is a string,
      // that's why one is an nsIURI and the other is a nsIURI.spec string.
      this.obsService.notifyObservers(oldURI, OBSERVER_TOPIC_URI_REWRITE, newSpec);
    } catch (e) {
      this.log(WARN, "Couldn't notify observers: " + e);
    }
  }

};

var prefs = 0;
function https_everywhereLog(level, str) {
  var econsole = Components.classes["@mozilla.org/consoleservice;1"]
      .getService(Components.interfaces.nsIConsoleService);
  if (prefs == 0) {
    prefs = HTTPSEverywhere.instance.get_prefs();
  } 
  try {
    var threshold = prefs.getIntPref(LLVAR);
  } catch (e) {
    econsole.logStringMessage( "HTTPS Everywhere: Failed to read about:config LogLevel");
    threshold = WARN;
  }
  if (level >= threshold) {
    dump(str+"\n");
    econsole.logStringMessage("HTTPS Everywhere: " +str);
  }
}

/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([HTTPSEverywhere]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([HTTPSEverywhere]);
