window.addEventListener("load", https_everywhere_load, true);
window.addEventListener("load", function load(event) {
  // need to wrap migratePreferences in another callback so that notification
  // always displays on browser restart
  window.removeEventListener("load", load, false);
  if (gBrowser) {
    gBrowser.addEventListener("DOMContentLoaded",
      migratePreferences.bind(null, gBrowser),
      true);
  }
}, false);

const CI = Components.interfaces;
const CC = Components.classes;

// LOG LEVELS ---
let VERB=1;
let DBUG=2;
let INFO=3;
let NOTE=4;
let WARN=5;

let HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                      .getService(Components.interfaces.nsISupports)
                      .wrappedJSObject;

// avoid polluting global namespace
// see: https://developer.mozilla.org/en-US/docs/Security_best_practices_in_extensions#Code_wrapping
if (!httpsEverywhere) { var httpsEverywhere = {}; }

/**
 * JS Object that acts as a namespace for the toolbar.
 *
 * Used to display toolbar hints to new users and change toolbar UI for cases
 * such as when the toolbar is disabled.
 */
httpsEverywhere.toolbarButton = {

  /**
   * Names of preferences for determining whether to show ruleset counters.
   */
  COUNTER_PREF: "extensions.https_everywhere.show_counter",
  COUNTER_TOTAL_PREF: "extensions.https_everywhere.show_counter_total",

  /**
   * Name of preference for whether HTTP Nowhere is on.
   */
  HTTP_NOWHERE_PREF: "extensions.https_everywhere.http_nowhere.enabled",

  /**
   * Used to determine if a hint has been previously shown.
   * TODO: Probably extraneous, look into removing
   */
  hintShown: false,

  /**
   * Initialize the toolbar button used to hint new users and update UI on
   * certain events.
   */
  init: function() {
    HTTPSEverywhere.log(DBUG, 'Removing listener for toolbarButton init.');
    window.removeEventListener('load', httpsEverywhere.toolbarButton.init, false);

    var tb = httpsEverywhere.toolbarButton;

    // make sure the checkbox for showing counters are properly set
    tb.updateMenuItems();

    // make sure UI is set depending on whether HTTPS-E is enabled
    toggleEnabledUI();

    // show ruleset counter when a tab is changed
    tb.updateRulesetsApplied();

    // There is no gBrowser object on Android. Instead Android uses the
    // window.BrowserApp object:
    // https://developer.mozilla.org/en-US/Add-ons/Firefox_for_Android/API/BrowserApp
    if (gBrowser) {
      gBrowser.tabContainer.addEventListener(
        'TabSelect',
        tb.updateRulesetsApplied,
        false
      );

      // add listener for top-level location change across all tabs
      let httpseProgressListener = {
        onLocationChange: function(aBrowser, aWebProgress, aReq, aLoc) {
          HTTPSEverywhere.log(DBUG, "Got on location change!");
          HTTPSEverywhere.resetApplicableList(aBrowser);
        },
        onStateChange: function(aBrowser, aWebProgress, aReq, aFlags, aStatus) {
          if ((gBrowser.selectedBrowser === aBrowser) &&
              (aFlags & CI.nsIWebProgressListener.STATE_STOP) &&
              aWebProgress.isTopLevel) {
            HTTPSEverywhere.log(DBUG, "Got on state change");
            tb.updateRulesetsApplied();
          }
        }
      };
      gBrowser.addTabsProgressListener(httpseProgressListener);
    }

    // decide whether to show toolbar hint
    let hintPref = "extensions.https_everywhere.toolbar_hint_shown";
    if (!Services.prefs.getPrefType(hintPref) 
        || !Services.prefs.getBoolPref(hintPref)) { 
      // only run once
      Services.prefs.setBoolPref(hintPref, true);
      // gBrowser unavailable on Android, see above.
      if (gBrowser) {
        gBrowser.addEventListener("DOMContentLoaded",
          tb.handleShowHint.bind(null, gBrowser),
          true);
      }
    }
  },

  /**
   * Shows toolbar hint if previously not shown.
   */
  handleShowHint: function(gBrowser) {
    var tb = httpsEverywhere.toolbarButton;
    if (!tb.hintShown){
      tb.hintShown = true;
      const faqURL = "https://www.eff.org/https-everywhere/faq";
      var nBox = gBrowser.getNotificationBox();
      var strings = document.getElementById('HttpsEverywhereStrings');
      var msg = strings.getString('https-everywhere.toolbar.hint');
      var hint = nBox.appendNotification(
        msg,
        'https-everywhere',
        'chrome://https-everywhere/skin/https-everywhere-24.png',
        nBox.PRIORITY_WARNING_MEDIUM,
      [],
      function(action) {
        // see https://developer.mozilla.org/en-US/docs/XUL/Method/appendNotification#Notification_box_events
        gBrowser.selectedTab = gBrowser.addTab(faqURL);
      });
    }
    gBrowser.removeEventListener("DOMContentLoaded", tb.handleShowHint, true);
  },

  selectedBrowser: function() {
    // gBrowser is unavailable on Android, see above.
    if (window.gBrowser) {
      return window.gBrowser.selectedBrowser;
    } else if (window.BrowserApp) {
      return window.BrowserApp.selectedBrowser;
    }
  },
   
  /**
   * Update the toolbar button image and menuitem checkboxes to current settings.
   * This is used when the UI is initialized.
   */
  updateMenuItems: function() {
    HTTPSEverywhere.log(INFO, 'Updating toolbar button image and menu item checkboxes.');
    var tb = httpsEverywhere.toolbarButton;

    var counterItem = document.getElementById('https-everywhere-counter-item');
    
    var uiFound = false;
    
    if (counterItem) { // If we can find the counterItem like this, we can find everything in the UI.
      uiFound = true;
      var counterTotalItem = document.getElementById('https-everywhere-counter-total-item');
      var httpNowhereItem = document.getElementById('http-nowhere-item');
      var toolbarbutton = document.getElementById('https-everywhere-button');
    } else {
      // If the toolbar button is hidden away in the Firefox hamburger menu,
      // we won't find it by the above, and need to look somewhere else
      var toolbox = document.getElementById("navigator-toolbox");
      if (toolbox) {
        let palette = toolbox.palette;
        counterItem = palette.querySelector("#https-everywhere-counter-item");
        if (counterItem) {
            HTTPSEverywhere.log(DBUG, 'The toolbar button was trying to hide');
            uiFound = true;
            counterItem.setAttribute('checked', showCounter);
            var counterTotalItem = palette.querySelector('#https-everywhere-counter-total-item');
            var httpNowhereItem = palette.querySelector('#http-nowhere-item');
            var toolbarbutton = palette.querySelector('#https-everywhere-button');
        }
      }
    }
    
    if (uiFound) {
      // make sure the checkbox for showing counters are properly set
      var showCounter = tb.shouldShowCounter();
      HTTPSEverywhere.log(DBUG, 'Setting ruleset counter checkbox to '+showCounter);
      counterItem.setAttribute('checked', showCounter);
      
      var showCounterTotal = tb.shouldShowCounterTotal();
      HTTPSEverywhere.log(DBUG, 'Setting total ruleset counter checkbox to '+showCounterTotal);
      counterTotalItem.setAttribute('checked', showCounterTotal);
      // No reason to be able to change the setting for showing the total
      // count of applicable rulesets if we do not even show the active ones.
      counterTotalItem.setAttribute('disabled', !showCounter);
      
      // make sure UI for HTTP Nowhere mode is properly set
      var showHttpNowhere = tb.shouldShowHttpNowhere();
      HTTPSEverywhere.log(DBUG, 'Setting HTTP Nowhere checkbox to '+showHttpNowhere);
      httpNowhereItem.setAttribute('checked', showHttpNowhere);
      toolbarbutton.setAttribute('http_nowhere', showHttpNowhere);
    } else {
      HTTPSEverywhere.log(WARN, 'UI not found.');
    }
  },
  
  /**
   * Update the rulesets applied counter for the current tab.
   */
  updateRulesetsApplied: function() {
    var toolbarbutton = document.getElementById('https-everywhere-button');
    if (!toolbarbutton) {
      // This becomes relevant for instance when the toolbar button is
      // hidden away in the Firefox hamburger menu.
      var toolbox = document.getElementById("navigator-toolbox");
      if (toolbox) {
        palette = toolbox.palette;
        var toolbarbutton = palette.querySelector('#https-everywhere-button');
        if (!toolbarbutton) {
          return;
        }
      }
    }

    var enabled = HTTPSEverywhere.prefs.getBoolPref("globalEnabled");
    var showCounter = httpsEverywhere.toolbarButton.shouldShowCounter();
    if (!enabled || !showCounter) { 
      toolbarbutton.setAttribute('rulesetsApplied', 0);
      return;
    }

    var browser = httpsEverywhere.toolbarButton.selectedBrowser();
    if (!browser) {
      return;
    }

    var alist = HTTPSEverywhere.getExpando(browser,"applicable_rules");
    if (!alist) {
      return;
    }
    // Make sure the list is up to date
    alist.populate_list();
    var rulesetsApplied = alist.count_applied();
    var rulesetsTotal = alist.count_all();
    
    if (!rulesetsTotal) {
      toolbarbutton.setAttribute('rulesetsApplied', 0);
      return;
    }

    var includeTotals = httpsEverywhere.toolbarButton.shouldShowCounterTotal();
    var counterLabel = includeTotals ? rulesetsApplied + '/' + rulesetsTotal : rulesetsApplied;
    
    toolbarbutton.setAttribute('rulesetsApplied', counterLabel);
    HTTPSEverywhere.log(INFO, 'Setting icon counter to: ' + counterLabel);
  },

  /**
   * Gets whether to show the rulesets applied counter.
   *
   * @return {boolean}
   */
  shouldShowCounter: function() {
    var tb = httpsEverywhere.toolbarButton;
    var sp = Services.prefs;

    var prefExists = sp.getPrefType(tb.COUNTER_PREF);

    // the default behavior is to show the rulesets applied counter.
    // if no preference exists (default) or its enabled, show the counter
    return !prefExists || sp.getBoolPref(tb.COUNTER_PREF);
  },

  /**
   * Gets whether to show the total ruleset count of applicable rulesets.
   *
   * @return {boolean}
   */
  shouldShowCounterTotal: function() {
    var tb = httpsEverywhere.toolbarButton;
    var sp = Services.prefs;

    var prefExists = sp.getPrefType(tb.COUNTER_TOTAL_PREF);

    // This time around, the default behavior is to not show the counter
    return prefExists && sp.getBoolPref(tb.COUNTER_TOTAL_PREF);
  },

  /**
   * Gets whether to show HTTP Nowhere UI.
   *
   * @return {boolean}
   */
  shouldShowHttpNowhere: function() {
    var tb = httpsEverywhere.toolbarButton;
    var sp = Services.prefs;
    return sp.getBoolPref(tb.HTTP_NOWHERE_PREF);
  },

  /**
   * Toggles the user's preference for displaying the rulesets applied counters
   * and updates the UI.
   */
  toggleShowCounter: function() {
    var tb = httpsEverywhere.toolbarButton;
    var sp = Services.prefs;

    var showCounter = !tb.shouldShowCounter();
    sp.setBoolPref(tb.COUNTER_PREF, showCounter);
    
    var counterTotalItem = document.getElementById('https-everywhere-counter-total-item');
    counterTotalItem.setAttribute('disabled', !showCounter);

    tb.updateRulesetsApplied();
  },
  toggleShowCounterTotal: function() {
    var tb = httpsEverywhere.toolbarButton;
    var sp = Services.prefs;

    var showCounterTotal = !tb.shouldShowCounterTotal();
    sp.setBoolPref(tb.COUNTER_TOTAL_PREF, showCounterTotal);
    tb.updateRulesetsApplied();
  },
  
  /**
   * Toggles whether HTTP Nowhere mode is active, updates the toolbar icon.
   */
  toggleHttpNowhere: function() {
    HTTPSEverywhere.toggleHttpNowhere();
    var tb = httpsEverywhere.toolbarButton;
    var showHttpNowhere = tb.shouldShowHttpNowhere();

    // Change icon color to red if HTTP nowhere is enabled
    var toolbarbutton = document.getElementById('https-everywhere-button');
    toolbarbutton.setAttribute('http_nowhere', showHttpNowhere);
    reload_window();
  },

  /**
   * Resets all rules to their default state.
   */
  resetToDefaults: function() {
    HTTPSEverywhere.https_rules.resetRulesetsToDefaults()
  }
};

function https_everywhere_load() {
  window.removeEventListener('load', https_everywhere_load, true);
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

var rulesetTestsMenuItem = null;

function show_applicable_list(menupopup) {
  var browser = httpsEverywhere.toolbarButton.selectedBrowser();
  if (!browser) {
    HTTPSEverywhere.log(WARN, "No browser for applicable list");
    return;
  }

  var alist = HTTPSEverywhere.getExpando(browser,"applicable_rules");
  var weird=false;

  if (!alist) {
    // This case occurs for error pages and similar.  We need a dummy alist
    // because populate_menu lives in there.  Would be good to refactor this
    // away.
    alist = new HTTPSEverywhere.ApplicableList(HTTPSEverywhere.log, browser.currentURI);
    weird = true;
  }
  alist.populate_menu(document, menupopup, weird);

  // should we also show the ruleset tests menu item?
  if(HTTPSEverywhere.prefs.getBoolPref("show_ruleset_tests")) {

    if(!rulesetTestsMenuItem) {
      let strings = document.getElementById('HttpsEverywhereStrings');
      let label = strings.getString('https-everywhere.menu.ruleset-tests');

      rulesetTestsMenuItem = this.document.createElement('menuitem');
      rulesetTestsMenuItem.setAttribute('command', 'https-everywhere-menuitem-ruleset-tests');
      rulesetTestsMenuItem.setAttribute('label', label);
    }

    if(!menupopup.contains(rulesetTestsMenuItem)) 
      menupopup.appendChild(rulesetTestsMenuItem);
  }
}

function toggle_rule(rule_id) {
  // toggle the rule state
  HTTPSEverywhere.https_rules.rulesetsByID[rule_id].toggle();
  reload_window();
}

function reload_window() {
  var browser = httpsEverywhere.toolbarButton.selectedBrowser();
  if (browser) {
    browser.reload();
  }
}

function toggleEnabledState(){
  HTTPSEverywhere.toggleEnabledState();
  reload_window();
  toggleEnabledUI();
}

function toggleEnabledUI() {
  // Add/remove menu items depending on whether HTTPS-E is enabled
  var items = document.querySelectorAll(".hide-on-disable");
  var enabled = HTTPSEverywhere.prefs.getBoolPref("globalEnabled");
  for (let i = 0; i < items.length; i++) {
    items[i].hidden = !enabled;
  }

  // Change icon depending on enabled state
  var toolbarbutton = document.getElementById('https-everywhere-button');
  if (!toolbarbutton) {
	// If we did not find the button, look for it in the hamburger menu.
    var toolbox = document.getElementById("navigator-toolbox");
    if (toolbox) {
      var palette = toolbox.palette;
      var toolbarbutton = palette.querySelector('#https-everywhere-button');
    }
  }
  if (toolbarbutton) {
    toolbarbutton.setAttribute('status', enabled ? 'enabled' : 'disabled');
  }
}

function open_in_tab(url) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var recentWindow = wm.getMostRecentWindow("navigator:browser");
  recentWindow.delayedOpenTab(url, null, null, null, null);
}

// hook event for showing hint
HTTPSEverywhere.log(DBUG, 'Adding listener for toolbarButton init.');
window.addEventListener("load", httpsEverywhere.toolbarButton.init, false);

function migratePreferences(gBrowser) {
  gBrowser.removeEventListener("DOMContentLoaded", migratePreferences, true);
  let prefs_version = HTTPSEverywhere.prefs.getIntPref("prefs_version");

  // first migration loses saved prefs
  if(prefs_version == 0) {
    try {
      // upgrades will have old rules as preferences, such as the EFF rule
      let upgrade = false;
      let childList = HTTPSEverywhere.prefs.getChildList("", {});
      for(let i=0; i<childList.length; i++) {
        if(childList[i] == 'EFF') {
          upgrade = true;
          break;
        }
      }

      if(upgrade) {
        let nBox = gBrowser.getNotificationBox();
        let strings = document.getElementById('HttpsEverywhereStrings');
        let msg = strings.getString('https-everywhere.migration.notification0');
        nBox.appendNotification(
          msg, 
          'https-everywhere-migration0', 
          'chrome://https-everywhere/skin/https-everywhere-24.png', 
          nBox.PRIORITY_WARNING_MEDIUM
        );
      }
    } catch(e) {
      HTTPSEverywhere.log(WARN, "Migration from prefs_version 0 error: "+e);
    }

    HTTPSEverywhere.prefs.setIntPref("prefs_version", prefs_version+1);
  }
}
