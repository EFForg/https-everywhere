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

var urlbarOptions = {
  title: "HTTPS Everywhere",
  icon: "chrome://https-everywhere/skin/https-everywhere-128.png",
  clickCallback: function() {
    rulesPrompt.setMultiChoiceItems(getRuleItems());
    rulesPrompt.show(function(data) {
      aWindow.alert(JSON.stringify(data));
    });
  }
};

// The prompt that shows up when someone clicks on the icon
var rulesPrompt = new Prompt({
  window: aWindow,
  title: "Enable/disable rules"
});

function getApplicableList() {
  var domWin = aWindow.content.document.defaultView.top;
  if (!(domWin instanceof CI.nsIDOMWindow)) {
    aWindow.console.log('something went wrong getting top window');
    return null;
  }
  return HTTPSEverywhere.getExpando(domWin,"applicable_rules", null);
}

// Show active/inactive rules in the popup
function getRuleItems() {
  var ruleItems = [];
  var alist = getApplicableList();
  for (var activeRule in alist.active) {
    if (alist.active.hasOwnProperty(activeRule)) {
      ruleItems.push({ label: activeRule, selected: true });
    }
  }
  for (var inactiveRule in alist.inactive) {
    if (alist.inactive.hasOwnProperty(inactiveRule)) {
      ruleItems.push({ label: inactiveRule });
    }
  }
  return ruleItems;
}

function toggleRule(rule_id) {
  // toggle the rule state
  HTTPSEverywhere.https_rules.rulesetsByID[rule_id].toggle();
  reloadTab();
}

function reloadTab() { return; }

function toggleEnabledState(){
  HTTPSEverywhere.toggleEnabledState();
  reloadTab();
}

// Here's the external API to this UI module
var FennecUI = {
  init: function() {
    loadIntoWindow();
  }
};
