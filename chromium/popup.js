/* global sendMessage */

"use strict";

var stableRules = null;
var unstableRules = null;
var hostReg = /.*\/\/[^$/]*\//;

var ls;
try {
  ls = localStorage;
} catch(e) {
  ls = {setItem: () => {}, getItem: () => {}};
}

function e(id) {
  return document.getElementById(id);
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

  checkbox.addEventListener('change', (checkbox, ruleset, tab_id) => {
    var ruleset_active = checkbox.checked;
    var set_ruleset = {
      active: ruleset_active,
      name: ruleset.name,
      tab_id: tab_id
    };

    sendMessage("set_ruleset_active_status", set_ruleset, () => {
      if (ruleset_active != ruleset.default_state) {
        ls[ruleset.name] = ruleset_active;
      } else {
        delete ls[ruleset.name];
        // purge the name from the cache so that this unchecking is persistent.
        sendMessage("delete_from_ruleset_cache", ruleset.name);
      }

      // Now reload the selected tab of the current window.
      chrome.tabs.reload();
    });
  });

  label.appendChild(checkbox);

  // favicon (from chrome's cache)
  var favicon = document.createElement("img");
  favicon.className = "favicon";
  favicon.src = "chrome://favicon/";
  for (let rule of ruleset.rules) {
    var host = hostReg.exec(rule.to);
    if (host) {
      favicon.src += host[0];
      break;
    }
  }

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

/**
 * Create the list of rules for a specific tab
 * @param tabArray
 */
function gotTab(tabArray) {
  var activeTab = tabArray[0];

  sendMessage("get_active_rulesets", activeTab.id, function(rulesets){
    for (var r in rulesets) {
      var listDiv = stableRules;
      if (!rulesets[r].default_state) {
        listDiv = unstableRules;
      }
      appendRuleLineToListDiv(rulesets[r], listDiv, activeTab.id);
      listDiv.style.position = "static";
      listDiv.style.visibility = "visible";
    }
    // Only show the "Add a rule" link if we're on an HTTPS page
    if (/^https:/.test(activeTab.url)) {
      show(e("add-rule-link"));
    }
  });
}

function updateDisabledState(value) {
  return document.body.className = value ? "" : "disabled";
}

/**
 * Fill in content into the popup on load
 */
document.addEventListener("DOMContentLoaded", () => {
  stableRules = e("StableRules");
  unstableRules = e("UnstableRules");
  chrome.tabs.query({ active: true, currentWindow: true }, gotTab);

  // Set up the enabled/disabled switch & hide/show rules
  getOption_('globalEnabled', true, function(item) {
    e('onoffswitch').checked = item.globalEnabled;
    updateDisabledState(item.globalEnabled);
    
    e('onoffswitch').addEventListener('change', evt => {
      setOption_('globalEnabled', evt.target.checked, () => {
        updateDisabledState(evt.target.checked);

        // The extension state changed, so reload this tab.
        chrome.tabs.reload();
        window.close();
      });
    });
  });

  // Print the extension's current version.
  e('current-version').innerText = chrome.runtime.getManifest().version;

  // Set up toggle checkbox for HTTP nowhere mode
  getOption_('httpNowhere', false, function(item) {
    var httpNowhereCheckbox = e('http-nowhere-checkbox');
    httpNowhereCheckbox.checked = item.httpNowhere;

    httpNowhereCheckbox.addEventListener('change', evt => {
      setOption_('httpNowhere', evt.target.checked);
    });
  });

  e("aboutTitle").title = chrome.i18n.getMessage("about_title");
  e("add-rule-link").addEventListener("click", addManualRule);
});

function escapeForRegex(value) {
  return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
}

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
  chrome.tabs.query({ active: true, currentWindow: true }, function(tab) {
    hide(e("add-rule-link"));
    show(e("add-new-rule-div"));

    const url = new URL(tab[0].url);

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

function getOption_(opt, defaultOpt, callback) {
  const details = {};
  details[opt] = defaultOpt;
  sendMessage("get_option", details, callback);
}

function setOption_(opt, value, callback) {
  const details = {};
  details[opt] = value;
  sendMessage("set_option", details, callback);
}
