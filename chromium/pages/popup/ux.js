/* global sendMessage */

"use strict";

function e(id) {
  return document.getElementById(id);
}

/**
 * Handles rule (de)activation in the popup
 */
function toggleRuleLine(event) {
  if (event.target.matches("input[type=checkbox]")) {
    chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
      const set_ruleset = {
        active: event.target.checked,
        name: event.target.nextSibling.innerText,
        tab_id: tabs[0].id,
      };

      sendMessage("set_ruleset_active_status", set_ruleset, () => {
        // purge the name from the cache so that this unchecking is persistent.
        sendMessage("delete_from_ruleset_cache", set_ruleset.name, () => {
          // Now reload the selected tab of the current window.
          chrome.tabs.reload();
        });
      });
    });
  }
}


/**
 * Creates rule lines (including checkbox and icon) for the popup
 * @param rulesets
 * @param list_div
 * @returns {*}
 */
function appendRulesToListDiv(rulesets, list_div) {
  if (rulesets && rulesets.length) {
    // template parent block for each ruleset
    let templateNode = document.createElement("div");
    templateNode.setAttribute("class", "rule");

    // checkbox
    let checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");

    // label "container"
    let label = document.createElement("label");

    // img "remove" button
    let templateRemove = document.createElement("img");
    templateRemove.src = chrome.extension.getURL("images/remove.png");
    templateRemove.className = "remove";

    templateNode.appendChild(checkbox);
    templateNode.appendChild(label);

    for (const ruleset of rulesets) {
      let node = templateNode.cloneNode(true);
      let checkbox = node.querySelector("input[type=checkbox]");
      let label = node.querySelector("label");

      checkbox.id = ruleset.name;
      checkbox.checked = ruleset.active;

      label.htmlFor = ruleset.name;
      label.innerText = ruleset.name;

      if (ruleset.note && ruleset.note.length) {
        node.title = ruleset.note;

        if (ruleset.note === "user rule") {
          let remove = templateRemove.cloneNode(true);
          node.appendChild(remove);

          remove.addEventListener("click", () => {
            sendMessage("remove_rule", ruleset, () => {
              list_div.removeChild(node);
            });
          });
        }
      }
      list_div.appendChild(node);
    }
    list_div.addEventListener("click", toggleRuleLine);
    show(list_div);
  }
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
    e('onoffswitch').checked = item.globalEnabled;
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
  var extension_toggle_effect = function() {
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
 * @param activeTab
 */
function gotTab(activeTab) {
  sendMessage("get_active_rulesets", activeTab.id, function(rulesets) {
    if (rulesets) {
      const stableRules = rulesets.filter(ruleset => ruleset.default_state);
      const unstableRules = rulesets.filter(ruleset => !ruleset.default_state);

      appendRulesToListDiv(stableRules, e("StableRules"));
      appendRulesToListDiv(unstableRules, e("UnstableRules"));
    }

    // Only show the "Add a rule" link if we're on an HTTPS page
    if (/^https:/.test(activeTab.url)) {
      show(e("add-rule-link"));
    }
  });

  console.log(activeTab.id);
}

/**
 * Fill in content into the popup on load
 */
document.addEventListener("DOMContentLoaded", function () {
  getTab(gotTab);

  // Set up the enabled/disabled switch & hide/show rules
  updateEnabledDisabledUI();
  e('onoffswitch').addEventListener('click', toggleEnabledDisabled);
  e('http-nowhere-checkbox').addEventListener('click', toggleHttpNowhere, false);
  e('reset-to-defaults').addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage("prefs_reset_defaults_message"))) {
      sendMessage("reset_to_defaults", null, () => {
        window.close();
      });
    }
  });

  // Print the extension's current version.
  var the_manifest = chrome.runtime.getManifest();
  var version_info = e('current-version');
  version_info.innerText = the_manifest.version;

  let rulesets_versions = e('rulesets-versions');
  sendMessage("get_ruleset_timestamps", null, timestamps => {
    for(let [update_channel, timestamp] of timestamps){
      if(timestamp > 0){
        let ruleset_date = new Date(timestamp * 1000);
        let ruleset_version_string = ruleset_date.getUTCFullYear() + "." + (ruleset_date.getUTCMonth() + 1) + "." + ruleset_date.getUTCDate();

        let timestamp_span = document.createElement("span");
        timestamp_span.className = "rulesets-version";
        timestamp_span.innerText = chrome.i18n.getMessage("about_rulesets_version") + " " + update_channel + ": " + ruleset_version_string;
        rulesets_versions.appendChild(timestamp_span);
      }
    }
  });
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
