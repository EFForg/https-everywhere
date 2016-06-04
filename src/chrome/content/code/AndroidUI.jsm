const CC = Components.classes;
const CI = Components.interfaces;
const CU = Components.utils;

var HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                      .getService(CI.nsISupports).wrappedJSObject;

CU.import("resource://gre/modules/Prompt.jsm");

var menuId;
var urlbarId;
var aWindow = getWindow();


/*
 * Setup/Teardown for the UI
 */

function loadIntoWindow() {
  if (!aWindow) {
    return;
  }
  var enabled = HTTPSEverywhere.prefs.getBoolPref("globalEnabled");
  addToggleItemToMenu(enabled);
  if (enabled) {
    urlbarId = aWindow.NativeWindow.pageactions.add(urlbarOptions);
  } else if (urlbarId) {
    aWindow.NativeWindow.pageactions.remove(urlbarId);
  }

  // When navigating away from a page, we want to clear the applicable list for
  // that page. There are a few different APIs to do this, but this is the one
  // that work on mobile. We trigger on pagehide rather than pageshow because we
  // want to capture subresources during load.
  var BrowserApp = aWindow.BrowserApp;
  BrowserApp.deck.addEventListener("pagehide", function(evt) {
    var browser = BrowserApp.getBrowserForDocument(evt.target);
    HTTPSEverywhere.resetApplicableList(browser);
  }, true);
}

function unloadFromWindow() {
  if (!aWindow) {
    return;
  }
  aWindow.NativeWindow.menu.remove(menuId);
  aWindow.NativeWindow.pageactions.remove(urlbarId);
}


/*
 * Add a menu item to toggle HTTPS Everywhere
 */

function addToggleItemToMenu(enabled) {
  if (menuId) { aWindow.NativeWindow.menu.remove(menuId); }
  var menuLabel = enabled ? "HTTPS Everywhere (on)" : "HTTPS Everywhere (off)";
  menuId = aWindow.NativeWindow.menu.add(menuLabel, null, function() {
    popupToggleMenu(aWindow, enabled);
  });
}

function popupToggleMenu(aWindow, enabled) {
  var buttons = [
    {
      label: "Yes",
      callback: function() {
        toggleEnabledState();
        var msg = enabled ? "HTTPS Everywhere disabled!" : "HTTPS Everywhere enabled!";
        aWindow.NativeWindow.toast.show(msg, "short");
        return true;
      }
    }, {
      label: "No",
      callback: function() { return false; }
    }
  ];
  var newState = enabled ? "off?" : "on?";
  aWindow.NativeWindow.doorhanger.show("Would you like to turn HTTPS Everywhere "+newState,
                                       "doorhanger-toggle", buttons);
}


/*
 * The HTTPS Everywhere icon in the URL bar shows a popup of rules that the
 * user can activate/deactivate. On long click, reset all rules to defaults.
 */

var popupInfo = {
  rules: [],
  ruleItems: [],
  ruleStatus: [],
  alist: null,
  getApplicableList: function() {
    var browser = aWindow.BrowserApp.selectedBrowser;
    return HTTPSEverywhere.getApplicableListForBrowser(browser);
  },
  fill: function() {
    this.clear();
    this.alist = this.getApplicableList();
    HTTPSEverywhere.log(4,"applicable list active: "+JSON.stringify(this.alist.active));
    HTTPSEverywhere.log(4,"applicable list inactive: "+JSON.stringify(this.alist.inactive));
    for (var rule in this.alist.all) {
      if (this.alist.active.hasOwnProperty(rule)) {
        // active rules are checked and toggleable
        this.ruleItems.push({ label: rule, selected: true });
        this.ruleStatus.push(true);
        this.rules.push(this.alist.active[rule]);
      } else if (this.alist.moot.hasOwnProperty(rule)) {
        // moot rules are checked and toggleable too
        this.ruleItems.push({ label: rule, selected: true });
        this.ruleStatus.push(true);
        this.rules.push(this.alist.moot[rule]);
      } else if (this.alist.inactive.hasOwnProperty(rule)) {
        // inactive rules are unchecked and toggleable
        this.ruleItems.push({ label: rule });
        this.ruleStatus.push(false);
        this.rules.push(this.alist.inactive[rule]);
      } else if (this.alist.breaking.hasOwnProperty(rule)) {
        // breaking rules are get a unicode clockwise arrow next to them
        var ruleLabel = "\u21B7"+rule;
        var isSelected = this.alist.breaking[rule].active;
        this.ruleItems.push({ label: ruleLabel, selected: isSelected });
        this.ruleStatus.push(isSelected);
        this.rules.push(this.alist.breaking[rule]);
      }
    }
  },
  clear: function() {
    this.rules = [];
    this.ruleItems = [];
    this.ruleStatus = [];
    this.alist = {};
  }
};

var urlbarOptions = {

  title: "HTTPS Everywhere",

  icon: "chrome://https-everywhere/skin/https-everywhere-128.png",

  clickCallback: function() {
    popupInfo.fill();
    rulesPrompt.setMultiChoiceItems(popupInfo.ruleItems);
    rulesPrompt.show(function(data) {
      var db = data.button;
      if (db === -1) { return null; } // user didn't click the accept button
      if (popupInfo.rules.length !== db.length) {
        // Why does db sometimes have an extra entry that doesn't correspond
        // to any of the ruleItems? No idea, but let's log it.
        HTTPSEverywhere.log(5,"Got length mismatch between popupInfo.ruleItems and data.button");
        HTTPSEverywhere.log(4,"Applicable rules: "+JSON.stringify(popupInfo.rules));
        HTTPSEverywhere.log(4, "data.button: "+JSON.stringify(db));
      }
      for (var i=0; i<popupInfo.rules.length; i++) {
        if (popupInfo.ruleStatus[i] !== db[i]) {
          HTTPSEverywhere.log(4, "toggling: "+JSON.stringify(popupInfo.rules[i]));
          popupInfo.rules[i].toggle();
        }
      }
      reloadTab();
      return null;
    });
  },

  longClickCallback: function() { popupResetDefaultsMenu(aWindow); }
};

var rulesPrompt = new Prompt({
  window: aWindow,
  title: "Enable/disable rules",
  buttons: ["Apply changes"]
});

function popupResetDefaultsMenu(aWindow) {
  var buttons = [
    {
      label: "Yes",
      callback: function() {
        resetToDefaults();
        var msg = "Default rules reset.";
        aWindow.NativeWindow.toast.show(msg, "short");
        return true;
      }
    }, {
      label: "No",
      callback: function() { return false; }
    }
  ];
  aWindow.NativeWindow.doorhanger.show("Reset all HTTPS Everywhere rules to defaults?",
                                       "doorhanger-reset", buttons);
}


/*
 * Some useful utils
 */

function reloadTab() {
  // There seems to be no API to do this directly?
  aWindow.BrowserApp.selectedTab.window.location.reload();
}

function toggleEnabledState(){
  HTTPSEverywhere.toggleEnabledState();
  loadIntoWindow();
  reloadTab();
}

function resetToDefaults() {
  HTTPSEverywhere.https_rules.resetRulesetsToDefaults();
  reloadTab();
}

function getWindow() {
  return CC['@mozilla.org/appshell/window-mediator;1']
      .getService(CI.nsIWindowMediator)
      .getMostRecentWindow('navigator:browser');
}


/*
 *  Here's the external API to this UI module
 */

var AndroidUI = {
  init: function() {
    loadIntoWindow();
  },
  shutdown: function() {
    unloadFromWindow();
  }
};

var EXPORTED_SYMBOLS = ["AndroidUI"];
