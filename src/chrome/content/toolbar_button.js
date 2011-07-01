window.addEventListener("load", https_everywhere_load, true);

const CI = Components.interfaces;
const CC = Components.classes;

// LOG LEVELS ---
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

function https_everywhere_load() {
  return;
  // on first run, put the context menu in the addons bar
  try {
    var first_run;
    try {
      first_run = Services.prefs.getBoolPref("extensions.https_everywhere.firstrun_context_menu");
    } catch(e) {
      Services.prefs.setBoolPref("extensions.https_everywhere.firstrun_context_menu", true);
      first_run = true;
    }
    if(first_run) {
      Services.prefs.setBoolPref("extensions.https_everywhere.firstrun_context_menu", false);
      var addon_bar = document.getElementById("addon-bar");
      if(addon_bar.currentSet.indexOf("https-everywhere-button") == -1) {
        var set = addon_bar.currentSet+',https-everywhere-button';
        addon_bar.setAttribute('currentset', set);
        addon_bar.currentSet = set;
        document.persist('addon-bar', 'currentset');
      }
    }
  } catch(e) { }
}

function show_applicable_list() {
  var domWin = content.document.defaultView.top;
  if (!(domWin instanceof CI.nsIDOMWindow)) {
    alert(domWin + " is not an nsIDOMWindow");
    return null;
  }

  var HTTPSEverywhere = CC["@eff.org/https-everywhere;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
  var alist = HTTPSEverywhere.getExpando(domWin,"applicable_rules", null);
  
  if (alist) {
    //alist.log(WARN,"Success wherein domWin is " + domWin);
    //alist.show_applicable();
    alist.populate_menu(document);
  } else {
    HTTPSEverywhere.log(WARN,"Failure wherein domWin is " + domWin);
    var str = "Missing applicable rules for " + domWin.document.baseURIObject.spec;
    str += "\ndomWin is " + domWin;
    alert(str);
    return null;
  }
}

function toggle_rule(rule_id) {
  // toggle the rule state
  var HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                      .getService(Components.interfaces.nsISupports)
                      .wrappedJSObject;
  HTTPSEverywhere.https_rules.rulesetsByID[rule_id].toggle();
  reload_window(HTTPSEverywhere);
}

function reload_window(HTTPSEverywhere) {
  var domWin = content.document.defaultView.top;
  if (!(domWin instanceof CI.nsIDOMWindow)) {
    HTTPSEverywhere.log(WARN, domWin + " is not an nsIDOMWindow");
    return null;
  }
  try {
    var webNav =  domWin.QueryInterface(CI.nsIInterfaceRequestor)
                        .getInterface(CI.nsIWebNavigation)
                        .QueryInterface(CI.nsIDocShell);
  } catch(e) {
    HTTPSEverywhere.log(WARN,"failed to get webNav");
    return null;
  }
  // This choice of flags comes from NoScript's quickReload function; not sure
  // if it's optimal
  webNav.reload(webNav.LOAD_FLAGS_CHARSET_CHANGE);
}

function open_in_tab(url) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var recentWindow = wm.getMostRecentWindow("navigator:browser");
  recentWindow.delayedOpenTab(url, null, null, null, null);
}

function chrome_opener(uri) {
  // we don't use window.open, because we need to work around TorButton's state control
  CC['@mozilla.org/appshell/window-mediator;1'].getService(CI.nsIWindowMediator)
                                               .getMostRecentWindow('navigator:browser')
                                               .open(uri,'', 'chrome,centerscreen' );
}
