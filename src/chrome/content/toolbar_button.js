window.addEventListener("load", https_everywhere_load, true);

const CI = Components.interfaces;
const CC = Components.classes;

// LOG LEVELS ---
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                      .getService(Components.interfaces.nsISupports)
                      .wrappedJSObject;

function https_everywhere_load() {
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
      var navbar = document.getElementById("nav-bar");
      if(navbar.currentSet.indexOf("https-everywhere-button") == -1) {
        var set = navbar.currentSet+',https-everywhere-button';
        navbar.setAttribute('currentset', set);
        navbar.currentSet = set;
        document.persist('nav-bar', 'currentset');
      }
    }
  } catch(e) { }
}

function stitch_context_menu() {
  // the same menu appears both under Tools and via the toolbar button:
  var menu = document.getElementById("https-everywhere-menu");
  if (!menu.firstChild) {
    var popup = document.getElementById("https-everywhere-context");
    menu.appendChild(popup.cloneNode(true));
  }
}
function stitch_context_menu2() {
  // the same menu appears both under Tools and via the toolbar button:
  var menu = document.getElementById("https-everywhere-menu2");
  if (!menu.firstChild) {
    var popup = document.getElementById("https-everywhere-context");
    menu.appendChild(popup.cloneNode(true));
  }
}

function show_applicable_list(menupopup) {
  var domWin = content.document.defaultView.top;
  if (!(domWin instanceof CI.nsIDOMWindow)) {
    alert(domWin + " is not an nsIDOMWindow");
    return null;
  }

  var alist = HTTPSEverywhere.getExpando(domWin,"applicable_rules", null);
  var weird=false;
  
  if (!alist) {
    // This case occurs for error pages and similar.  We need a dummy alist
    // because populate_menu lives in there.  Would be good to refactor this
    // away.
    alist = new HTTPSEverywhere.ApplicableList(HTTPSEverywhere.log, document, domWin);
    weird = true;
  }
  alist.populate_menu(document, menupopup, weird);
}

function toggle_rule(rule_id) {
  // toggle the rule state
  HTTPSEverywhere.https_rules.rulesetsByID[rule_id].toggle();
  var domWin = content.document.defaultView.top;
  /*if (domWin instanceof CI.nsIDOMWindow) {
    var alist = HTTPSEverywhere.getExpando(domWin,"applicable_rules", null);
    if (alist) alist.empty();
  }*/
  reload_window();
}

function reload_window() {
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
  
//The code below works fine for switching between HTTP/HTTPS when reload_window() is called.
//However, reload_window() is also called for changing rulesets that do not affect page location (but rather content within a page)
//Maybe add code to determine if a ruleset applies to the domain in the location bar, and reload to the proper scheme if so?
/*
	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);

    var uri = gBrowser.getBrowserForDocument(gBrowser.contentDocument).currentURI;	
	var newURI = "";
	
	if(uri.scheme == "https")
		var newURI = uri.asciiSpec.replace("https://", "http://");
	else
		var newURI = uri.asciiSpec.replace("http://", "https://");
		
    window.content.wrappedJSObject.location = newURI;
*/
}

function open_in_tab(url) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var recentWindow = wm.getMostRecentWindow("navigator:browser");
  recentWindow.delayedOpenTab(url, null, null, null, null);
}
