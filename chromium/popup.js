/* global sendMessage */

"use strict";

var stableRules = null;
var unstableRules = null;

function e(id) {
  return document.getElementById(id);
}

/**
 * Handles rule (de)activation in the popup
 * @param checkbox checkbox being clicked
 * @param ruleset the ruleset tied tot he checkbox
 */
function toggleRuleLine(checkbox, ruleset, tab_id) {
  var ruleset_active = checkbox.checked;
  var set_ruleset = {
    active: ruleset_active,
    name: ruleset.name,
    tab_id: tab_id
  };

  sendMessage("set_ruleset_active_status", set_ruleset, function(){

    if (ruleset_active == ruleset.default_state) {
      // purge the name from the cache so that this unchecking is persistent.
      sendMessage("delete_from_ruleset_cache", ruleset.name);
    }

    // Now reload the selected tab of the current window.
    chrome.tabs.reload();
  });
}

/**
 * Creates a rule line (including checkbox and icon) for the popup
 * @param ruleset the ruleset to build the line for
 * @returns {*}
 */
function appendRuleLineToListDiv(ruleset, list_div, tab_id) {

  // parent block for line
  var line = document.createElement("div");
  line.className = "rule checkbox";

  // label "container"
  var label = document.createElement("label");

  // checkbox
  var checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = ruleset.active;
  checkbox.onchange = function() {
    toggleRuleLine(checkbox, ruleset, tab_id);
  };
  label.appendChild(checkbox);

  // label text
  var text = document.createElement("span");
  text.innerText = ruleset.name;
  if (ruleset.note.length) {
    text.title = ruleset.note;
  }

  if(ruleset.note == "user rule") {
    var remove = document.createElement("img");
    remove.src = chrome.extension.getURL("remove.png");
    remove.className = "remove";
    line.appendChild(remove);

    remove.addEventListener("click", function(){
      sendMessage("remove_rule", ruleset);
      list_div.removeChild(line);
    });
  }

  label.appendChild(text);

  line.appendChild(label);

  list_div.appendChild(line);
}

function showHttpNowhereUI() {
  // Set up checkbox for HTTP nowhere mode
  getOption_('httpNowhere', false, function(item) {
    if (item.httpNowhere) {
      e('http-nowhere-checkbox').checked = true;
    }
    e('HttpNowhere').style.visibility = "visible";
  });
};

// Change the UI to reflect extension enabled/disabled
function updateEnabledDisabledUI() {
  getOption_('globalEnabled', true, function(item) {
    document.getElementById('onoffswitch').checked = item.globalEnabled;
    e('disableButton').style.visibility = "visible";
    // Hide or show the rules sections
    if (item.globalEnabled) {
      document.body.className = ""
      showHttpNowhereUI()
    } else {
      document.body.className = "disabled"
    }
  });
}

// Toggle extension enabled/disabled status
function toggleEnabledDisabled() {
  var extension_toggle_effect = function(){
    updateEnabledDisabledUI();
    // The extension state changed, so reload this tab.
    chrome.tabs.reload();
    window.close();
  }

  getOption_('globalEnabled', true, function(item) {
    setOption_('globalEnabled', !item.globalEnabled, extension_toggle_effect);
  });

}

/**
 * Create the list of rules for a specific tab
 * @param tabArray
 */
function gotTab(activeTab) {
  sendMessage("get_active_rulesets", activeTab.id, function(rulesets){
    for (var r in rulesets) {
      var listDiv = stableRules;
      if (!rulesets[r].default_state) {
        listDiv = unstableRules;
      }
      appendRuleLineToListDiv(rulesets[r], listDiv, activeTab.id);
      listDiv.style.display = 'block';
    }
    // Only show the "Add a rule" link if we're on an HTTPS page
    if (/^https:/.test(activeTab.url)) {
      show(e("add-rule-link"));
    }
  });
}

/**
 * Fill in content into the popup on load
 */
document.addEventListener("DOMContentLoaded", function () {
  stableRules = document.getElementById("StableRules");
  unstableRules = document.getElementById("UnstableRules");
  getTab(gotTab);

  // Set up the enabled/disabled switch & hide/show rules
  updateEnabledDisabledUI();
  document.getElementById('onoffswitch').addEventListener('click', toggleEnabledDisabled);
  e('http-nowhere-checkbox').addEventListener('click', toggleHttpNowhere, false);

  // Print the extension's current version.
  var the_manifest = chrome.runtime.getManifest();
  var version_info = document.getElementById('current-version');
  version_info.innerText = the_manifest.version;

  e("aboutTitle").title = chrome.i18n.getMessage("about_title");
  e("add-rule-link").addEventListener("click", addManualRule);
});


var escapeForRegex = function( value ) {
  return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
};

function hide(elem) {
  elem.style.display = "none";
}

function show(elem) {
  elem.style.display = "block";
}

/**
 * Handles the manual addition of rules
 */
function addManualRule() {
  getTab(function(tab) {
    hide(e("add-rule-link"));
    show(e("add-new-rule-div"));

    const url = new URL(tab.url);

    e("new-rule-host").value = url.host;

    const escapedHost = escapeForRegex(url.host);

    e("new-rule-regex").value = `^http://${escapedHost}/`;
    e("new-rule-redirect").value = `https://${url.host}/`;
    e("new-rule-name").value = "Manual rule for " + url.host;

    e("add-new-rule-button").addEventListener("click", function() {
      const params = {
        host : e("new-rule-host").value,
        redirectTo : e("new-rule-redirect").value,
        urlMatcher : e("new-rule-regex").value
      };
      sendMessage("add_new_rule", params, function() {
        location.reload();
      });
    });

    e("cancel-new-rule").addEventListener("click", function() {
      show(e("add-rule-link"));
      hide(e("add-new-rule-div"));
    });

    e("new-rule-show-advanced-link").addEventListener("click", function() {
      show(e("new-rule-advanced"));
      hide(e("new-rule-regular-text"));
    });

    e("new-rule-hide-advanced-link").addEventListener("click", function() {
      hide(e("new-rule-advanced"));
      show(e("new-rule-regular-text"));
    });
  });
}

function toggleHttpNowhere() {
  getOption_('httpNowhere', false, function(item) {
    setOption_('httpNowhere', !item.httpNowhere);
  });
}

function getOption_(opt, defaultOpt, callback) {
  var details = {};
  details[opt] = defaultOpt;
  sendMessage("get_option", details, callback);
}

function setOption_(opt, value, callback) {
  var details = {};
  details[opt] = value;
  sendMessage("set_option", details, callback);
}

function getTab(callback) {
  let url = new URL(window.location.href);
  if (url.searchParams.has('tabId')) {
    let parentId = Number(url.searchParams.get('tabId'));
    return chrome.tabs.get(parentId, callback);
  }
  chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => callback(tabs[0]));
}
