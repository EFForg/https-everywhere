// LOG LEVELS ---

VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

//---------------

https_everywhere_blacklist = {};

//
const CI = Components.interfaces;
const CC = Components.classes;
const CU = Components.utils;
const CR = Components.results;

const CP_SHOULDPROCESS = 4;

const SERVICE_CTRID = "@eff.org/https-everywhere;1";
const SERVICE_ID=Components.ID("{32c165b4-fe5e-4964-9250-603c410631b4}");

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
      arguments.callee(arguments[j]);
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

function https_everywhereLog(level, str) {
  if (level >= WARN) {
    dump(str+"\n");
    var econsole = Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService);
    econsole.logStringMessage("HTTPS Everywhere: " +str);
  }
}

function HTTPSEverywhere() {
  // Hacks to set up logging in each component
  HTTPS.log = https_everywhereLog;
  HTTPSRules.log = https_everywhereLog;
  RuleWriter.log = https_everywhereLog;
  this.log = https_everywhereLog;
  this.wrappedJSObject = this;
  this.https_rules = HTTPSRules;

  // We need to use observers instead of categories for FF3.0 for these:
  // https://developer.mozilla.org/en/Observer_Notifications
  // https://developer.mozilla.org/en/nsIObserverService.
  // https://developer.mozilla.org/en/nsIObserver
  var obsService = CC["@mozilla.org/observer-service;1"]
                    .getService(Components.interfaces.nsIObserverService);
  obsService.addObserver(this, "profile-before-change", false);
  obsService.addObserver(this, "profile-after-change", false);
  return;
}

// This defines for Mozilla what stuff HTTPSEverywhere will implement.

// We need to use both ContentPolicy and Observer, because there are some
// things, such as Favicons, who don't get caught by ContentPolicy; we don't
// yet know why we don't just use the observer :/

// ChannelEventSink seems to be necessary in order to handle redirects (eg
// HTTP redirects) correctly.

HTTPSEverywhere.prototype = {
  QueryInterface: function(iid) {
    if (!iid.equals(CI.nsIObserver)
        && !iid.equals(CI.nsISupports)
        && !iid.equals(CI.nsIContentPolicy)
        && !iid.equals(CI.nsISupportsWeakReference)
        && !iid.equals(CI.nsIWebProgressListener)
        && !iid.equals(CI.nsIChannelEventSink)) {
      Components.returnCode = CR.NS_ERROR_NO_INTERFACE;
      this.log(INFO,"Bad QI: "+iid);
      return null;
    }
    this.log(VERB,"Good QI: "+iid);
    return this;
  },
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
    } else if (topic == "app-startup") {
      this.log(DBUG,"Got app-startup");
      OS.addObserver(this, "http-on-modify-request", false);
      var dls = CC['@mozilla.org/docloaderservice;1']
        .getService(CI.nsIWebProgress);
      dls.addProgressListener(this, CI.nsIWebProgress.NOTIFY_STATE_REQUEST);
      this.log(INFO,"ChannelReplacement.supported = "+ChannelReplacement.supported);
    } else if (topic == "profile-before-change") {
      this.log(INFO, "Got profile-before-change");
      var catman = Components.classes["@mozilla.org/categorymanager;1"]
           .getService(Components.interfaces.nsICategoryManager);
      catman.deleteCategoryEntry("net-channel-event-sinks", SERVICE_CTRID, true);
      Thread.hostRunning = false;
    } else if (topic == "profile-after-change") {
      // This is currently separate from app-startup for hackish historical
      // reasons; not sure if that's necessary.
      this.log(DBUG, "Got profile-after-change");
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

  // These implement the nsIContentPolicy API; they allow both yes/no answers
  // to "should this load?", but also allow us to change the thing.

  shouldLoad: function(aContentType, aContentLocation, aRequestOrigin, aContext, aMimeTypeGuess, aInternalCall) {
    if (aContentType == 11) {
      try {
        this.log(DBUG, "shouldLoad: "+aContentLocation.spec);
      } catch (e) {
        this.log(DBUG,"shouldLoad exception");
      }
    }
    var unwrappedLocation = IOUtil.unwrapURL(aContentLocation);
    var scheme = unwrappedLocation.scheme;
    // XXX do we want to remove the s here?
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

      this.log(1, "called get_prefbranch()");
      o_prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService);
      if (!o_prefs)
      {
          this.log(WARN, "Failed to get preferences-service!");
          return false;
      }

      o_branch = o_prefs.getBranch(branch_name);
      if (!o_branch)
      {
          this.log(WARN, "Failed to get prefs branch!");
          return false;
      }

      return o_branch;
  },

};

/*
 * Factory object
 */

var HTTPSInstance = null;

const factory = {
  // nsIFactory interface implementation
  createInstance: function(outer, iid) {
    if (outer != null) {
      Components.returnCode = CR.NS_ERROR_NO_AGGREGATION;
      return null;
    }

    if (!iid.equals(Components.interfaces.nsIContentPolicy) &&
            !iid.equals(Components.interfaces.nsIChannelEventSink) &&
            !iid.equals(Components.interfaces.nsISupports)) {
      Components.returnCode = CR.NS_ERROR_NO_INTERFACE;
      return null;
    }

    if(!HTTPSInstance)
        HTTPSInstance = new HTTPSEverywhere();

    return HTTPSInstance;
  },

  // nsISupports interface implementation
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) ||
        iid.equals(Components.interfaces.nsIModule) ||
        iid.equals(Components.interfaces.nsIFactory))
      return this;

    Components.returnCode = CR.NS_ERROR_NO_INTERFACE;
    return null;
  }
};


/*
 * Module object
 */
const module = {
  registerSelf: function(compMgr, fileSpec, location, type) {
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(SERVICE_ID,
                    "HTTPS-Everywhere",
                    SERVICE_CTRID,
                    fileSpec, location, type);

    var catman = Components.classes["@mozilla.org/categorymanager;1"]
           .getService(Components.interfaces.nsICategoryManager);
    catman.addCategoryEntry("app-startup", SERVICE_CTRID,
              SERVICE_CTRID, true, true);
    catman.addCategoryEntry("content-policy", SERVICE_CTRID,
              SERVICE_CTRID, true, true);

  },

  unregisterSelf: function(compMgr, fileSpec, location) {
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);

    compMgr.unregisterFactoryLocation(SERVICE_ID, fileSpec);

    var catman = Components.classes["@mozilla.org/categorymanager;1"]
             .getService(Components.interfaces.nsICategoryManager);
    catman.deleteCategoryEntry("app-startup", SERVICE_CTRID, true);
    catman.deleteCategoryEntry("content-policy", SERVICE_CTRID, true);
  },

  getClassObject: function(compMgr, cid, iid) {
    if (cid.equals(SERVICE_ID))
      return factory;

    Components.returnCode = CR.NS_ERROR_NOT_REGISTERED;
    return null;
  },

  canUnload: function(compMgr) {
    return true;
  }
};

function NSGetModule(comMgr, fileSpec) {
  return module;
}


