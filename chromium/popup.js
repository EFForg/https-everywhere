"use strict";

var stableRules = null;
var unstableRules = null;
var hostReg = /.*\/\/[^$/]*\//;

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

    if (ruleset_active != ruleset.default_state) {
      localStorage[ruleset.name] = ruleset_active;
    } else {
      delete localStorage[ruleset.name];
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
function appendRuleLineToListDiv(ruleset, list_div) {

  // parent block for line
  var line = document.createElement("div");
  line.className = "rule checkbox";

  // label "container"
  var label = document.createElement("label");

  // checkbox
  var checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  if (ruleset.active) {
    checkbox.setAttribute("checked", "");
  }
  checkbox.onchange = function(ev) {
    toggleRuleLine(checkbox, ruleset, tab_id);
  };
  label.appendChild(checkbox);

  // favicon (from chrome's cache)
  var favicon = document.createElement("img");
  favicon.className = "favicon";
  favicon.src = "chrome://favicon/";
  for (var i=0; i < ruleset.rules.length; i++) {
    var host = hostReg.exec(ruleset.rules[i].to);
    if (host) {
      favicon.src += host[0];
      break;
    }
  }
  var xhr = new XMLHttpRequest();
  try {
    xhr.open("GET", favicon.src, true);
    label.appendChild(favicon);
  } catch (e) {}

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

// Change the UI to reflect extension enabled/disabled
function updateEnabledDisabledUI() {
  sendMessage("get_is_extension_enabled", null, function(enabled){
    document.getElementById('onoffswitch').checked = enabled;
    // Hide or show the rules sections
    if (enabled) {
      document.body.className = ""
    } else {
      document.body.className = "disabled"
    }
    sendMessage("update_state");
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

  sendMessage("get_is_extension_enabled", null, function(enabled){
    if (enabled) {
      // User wants to disable us
      sendMessage("set_is_extension_enabled", false, extension_toggle_effect);
    } else {
      // User wants to enable us
      sendMessage("set_is_extension_enabled", true, extension_toggle_effect);
    }
  });
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
      appendRuleLineToListDiv(rulesets[r], listDiv);
      listDiv.style.position = "static";
      listDiv.style.visibility = "visible";
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
  chrome.tabs.query({ active: true, currentWindow: true }, gotTab);

  // Set up the enabled/disabled switch & hide/show rules
  updateEnabledDisabledUI();
  document.getElementById('onoffswitch').addEventListener('click', toggleEnabledDisabled);

  // Print the extension's current version.
  var the_manifest = chrome.runtime.getManifest();
  var version_info = document.getElementById('current-version');
  version_info.innerText = the_manifest.version;

  // Set up toggle checkbox for HTTP nowhere mode
  getOption_('httpNowhere', false, function(item) {
    var httpNowhereCheckbox = document.getElementById('http-nowhere-checkbox');
    httpNowhereCheckbox.addEventListener('click', toggleHttpNowhere, false);
    var httpNowhereEnabled = item.httpNowhere;
    if (httpNowhereEnabled) {
      httpNowhereCheckbox.setAttribute('checked', '');
    }
  });

  // auto-translate all elements with i18n attributes
  var elem = document.querySelectorAll("[i18n]");
  for (var i=0; i < elem.length; i++) {
    elem[i].innerHTML = chrome.i18n.getMessage(elem[i].getAttribute("i18n"));
  }

  // other translations
  e("aboutTitle").setAttribute("title", chrome.i18n.getMessage("about_title"));
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
  chrome.tabs.query({ active: true, currentWindow: true }, function(tab) {
    hide(e("add-rule-link"));
    show(e("add-new-rule-div"));
    var newUrl = document.createElement('a');
    newUrl.href = tab[0].url;
    newUrl.protocol = "https:";
    e("new-rule-host").value = newUrl.host;
    var oldUrl = document.createElement('a');
    oldUrl.href = tab[0].url;
    oldUrl.protocol = "http:";
    var oldMatcher = "^" + escapeForRegex(oldUrl.protocol + "//" + oldUrl.host+ "/");
    e("new-rule-regex").value = oldMatcher;
    var redirectPath = newUrl.protocol + "//" + newUrl.host + "/";
    e("new-rule-redirect").value = redirectPath;
    e("new-rule-name").value = "Manual rule for " + oldUrl.host;
    e("add-new-rule-button").addEventListener("click", function() {
      var params = {
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

function setOption_(opt, value) {
  var details = {};
  details[opt] = value;
  sendMessage("set_option", details);
}

function sendMessage(type, object, callback) {
  var packet = {};
  packet.type = type;
  if(object){
    packet.object = object;
  }
  chrome.runtime.sendMessage(packet, callback);
}
