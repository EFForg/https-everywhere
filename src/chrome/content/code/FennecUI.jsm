var EXPORTED_SYMBOLS = ["FennecUI"];

const CC = Components.classes;
const CI = Components.interfaces;
const CU = Components.utils;

var HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                      .getService(CI.nsISupports).wrappedJSObject;

CU.import("resource://gre/modules/Prompt.jsm");

var menuId;
var urlbarId;
var aWindow = getWindow();

function getWindow() {
  return CC['@mozilla.org/appshell/window-mediator;1']
      .getService(CI.nsIWindowMediator)
      .getMostRecentWindow('navigator:browser');
}

function loadIntoWindow() {
  if (!aWindow) {
    return;
  }
  menuId = aWindow.NativeWindow.menu.add("HTTPS Everywhere", null, function() {
    popupToggleMenu(aWindow);
  });
  urlbarId = aWindow.NativeWindow.pageactions.add(urlbarOptions);
}

function unloadFromWindow() {
  if (!aWindow) {
    return;
  }
  aWindow.NativeWindow.menu.remove(menuId);
  aWindow.NativeWindow.pageactions.remove(urlbarId);
}

function popupToggleMenu(aWindow) {
 var buttons = [
   {
      label: "Yes",
      callback: function() {
        aWindow.NativeWindow.toast.show("HTTPS Everywhere disabled!", "short");
      }
    }, {
      label: "No",
      callback: function() {
      }
    }
 ];
 aWindow.NativeWindow.doorhanger.show("Would you like to turn off HTTPS Everywhere?", "doorhanger-test", buttons);
}

/*
 * The HTTPS Everywhere icon in the URL bar shows a menu of rules that the
 * user can activate/deactivate. Here's some code to create it and update the
 * rule list dynamically.
 */

var popupInfo = {
  rules: [],
  ruleItems: [],
  ruleStatus: [],
  alist: null,
  getApplicableList: function () {
    var domWin = aWindow.BrowserApp.selectedTab.window;
    if (!(domWin instanceof CI.nsIDOMWindow)) {
      HTTPSEverywhere.log(5,'something went wrong getting top window');
      return null;
    }
    return HTTPSEverywhere.getExpando(domWin,"applicable_rules", null);
  },
  fill: function() {
    this.clear();
    this.alist = this.getApplicableList();
    HTTPSEverywhere.log(5,"applicable list: "+JSON.stringify(this.alist.active));
    for (var activeRule in this.alist.active) {
      if (this.alist.active.hasOwnProperty(activeRule)) {
        this.ruleItems.push({ label: activeRule, selected: true });
        this.ruleStatus.push(true);
        this.rules.push(this.alist.active[activeRule]);
      }
    }
    for (var inactiveRule in this.alist.inactive) {
      if (this.alist.inactive.hasOwnProperty(inactiveRule)) {
        this.ruleItems.push({ label: inactiveRule });
        this.ruleStatus.push(false);
        this.rules.push(this.alist.inactive[inactiveRule]);
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
        HTTPSEverywhere.log(5,"popupInfo length not same as button response");
        HTTPSEverywhere.log(5,JSON.stringify(popupInfo.rules));
        HTTPSEverywhere.log(5,JSON.stringify(db));
      }
      for (var i=0; i<popupInfo.rules.length; i++) {
        if (popupInfo.ruleStatus[i] !== db[i]) {
          HTTPSEverywhere.log(5,"toggling: "+JSON.stringify(popupInfo.rules[i]));
          popupInfo.rules[i].toggle();
        }
      }
      reloadTab();
      return null;
    });
  }
};

// The prompt that shows up when someone clicks on the icon
var rulesPrompt = new Prompt({
  window: aWindow,
  title: "Enable/disable rules",
  buttons: ["Apply changes"]
});

function reloadTab() {
  // There seems to be no API to do this directly?
  aWindow.BrowserApp.selectedTab.window.location.reload();
}

function toggleEnabledState(){
  HTTPSEverywhere.toggleEnabledState();
  reloadTab();
}

// Here's the external API to this UI module
var FennecUI = {
  init: function() {
    loadIntoWindow();
  },
  shutdown: function() {
    unloadFromWindow();
  }
};
