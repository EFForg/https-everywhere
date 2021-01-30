/* global e */
/* global hide */
/* global show */
/* global sendMessage */
/* global getOption_ */
/* global setOption_ */

"use strict";

/**
 * Handles rule (de)activation in the popup
 */
function toggleRuleLine(event) {
  getTab(activeTab => {
    const set_ruleset = {
      active: event.target.checked,
      name: event.target.parentNode.innerText,
      tab_id: activeTab.id,
    };

    sendMessage("set_ruleset_active_status", set_ruleset, () => {
      // purge the name from the cache so that this unchecking is persistent.
      sendMessage("delete_from_ruleset_cache", set_ruleset.name, () => {
        // Now reload the selected tab of the current window.
        chrome.tabs.reload(set_ruleset.tab_id);
      });
    });
  });
}

/**
 * @param {object} event
 * @description Toggles content for user to view rules and explanations for different modes
 */
function toggleSeeMore(event) {
  let target = event.target;
  let content;

  if (target !== this) {
    content = document.querySelector('.see_more__content');
  } else {
    content = target.parentNode.querySelector('.see_more__content');
  }

  let arrow  = target.parentNode.querySelector('.see_more__arrow');
  let text = target.parentNode.querySelector('.see_more__text');

  if(arrow.classList.contains('down')) {
    arrow.classList.replace('down', 'up');
    text.innerText = chrome.i18n.getMessage("menu_seeLess");
  } else if (arrow.classList.contains('up')) {
    arrow.classList.replace('up', 'down');
    text.innerText = chrome.i18n.getMessage("menu_seeMore");
  }

  if (content.classList.contains('hide')) {
    content.classList.replace('hide', 'show');
  } else if (content.classList.contains('show')) {
    content.classList.replace('show', 'hide');
  }
}

/**
 * Creates rule lines (including checkbox and icon) for the popup
 * @param rulesets
 * @param list_div
 * @param {string} ruleType
 * @returns {*}
 */
function appendRulesToListDiv(rulesets, list_div, ruleType) {
  if (rulesets && rulesets.length) {
    // template parent block for each ruleset
    let templateLine = document.createElement("div");
    templateLine.className = "rule checkbox";

    // label "container"
    let templateLabel = document.createElement("label");

    // checkbox
    let templateCheckbox = document.createElement("input");
    templateCheckbox.type = "checkbox";

    // label text
    let templateLabelText = document.createElement("span");

    // img "remove" button
    let templateRemove = document.createElement("img");
    templateRemove.src = chrome.runtime.getURL("images/remove.png");
    templateRemove.className = "remove";

    templateLine.appendChild(templateCheckbox);
    templateLabel.appendChild(templateLabelText);
    templateLine.appendChild(templateLabel);

    let increment = 0;

    for (const ruleset of rulesets) {
      increment++;
      let line = templateLine.cloneNode(true);
      let checkbox = line.querySelector("input[type=checkbox]");
      let label = line.querySelector("label");
      let text = line.querySelector("span");

      // For each "id" attribute in each checkbox input and "for" attribute in label
      checkbox.setAttribute("id", `${ruleType}_ruleset_${increment}`);
      label.setAttribute("for", `${ruleType}_ruleset_${increment}`);

      checkbox.checked = ruleset.active;
      text.innerText = ruleset.name;

      // Add listener to capture the toggle event
      line.addEventListener("click", toggleRuleLine);

      if (ruleset.note && ruleset.note.length) {
        line.title = ruleset.note;

        if (ruleset.note === "user rule") {
          let remove = templateRemove.cloneNode(true);
          line.appendChild(remove);

          remove.addEventListener("click", () => {
            sendMessage("remove_rule", { ruleset, src: 'popup' }, () => {
              list_div.removeChild(line);
            });
          });
        }
      }
      list_div.appendChild(line);
    }
    show(list_div);
  }
}

function showHttpNowhereUI() {
  // Set up checkbox for HTTP nowhere mode
  getOption_('httpNowhere', false, function(item) {
    if (item.httpNowhere) {
      e('http-nowhere-checkbox').checked = true;
      e('HttpNowhere__header').innerText = chrome.i18n.getMessage("menu_encryptAllSitesEligibleOn");
      e('HttpNowhere__explained').innerText = chrome.i18n.getMessage("menu_httpNoWhereExplainedBlocked");
    } else {
      e('HttpNowhere__header').innerText = chrome.i18n.getMessage("menu_encryptAllSitesEligibleOff");
      e('HttpNowhere__explained').innerText = chrome.i18n.getMessage("menu_httpNoWhereExplainedAllowed");
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
      document.body.className = "";
      e('onoffswitch_label').innerText = chrome.i18n.getMessage("menu_globalEnable");
      showHttpNowhereUI();
    } else {
      document.body.className = "disabled";
      e('onoffswitch_label').innerText = chrome.i18n.getMessage("menu_globalDisable");
    }
  });
}

// Toggle extension enabled/disabled status
function toggleEnabledDisabled() {
  let extension_toggle_effect = function() {
    updateEnabledDisabledUI();
    // The extension state changed, give some time for toggle animation and reload tab
    setTimeout(function() {
      chrome.tabs.reload();
      window.close();
    }, 1500);
  };

  getOption_('globalEnabled', true, function(item) {
    setOption_('globalEnabled', !item.globalEnabled, extension_toggle_effect);
  });
}

/**
 * @description Create the list of rules for a specific tab
 * @param activeTab
 */
function listRules(activeTab) {
  sendMessage("get_applied_rulesets", activeTab.id, function(rulesets) {
    if (rulesets) {
      // show the number of potentially applicable rulesets
      let counter = rulesets.length;
      let counterElement = document.querySelector("#RuleManagement--counter");
      counterElement.innerText = counter;

      const stableRules = rulesets.filter(ruleset => ruleset.default_state);
      const unstableRules = rulesets.filter(ruleset => !ruleset.default_state);

      appendRulesToListDiv(stableRules, e("StableRules"), 'stable');
      appendRulesToListDiv(unstableRules, e("UnstableRules"), 'unstable');
    }

    // Only show the "Add a rule" section if we're on an HTTPS page
    if (/^https:/.test(activeTab.url)) {
      show(e("addRuleSection"));
    }
  });
}

/**
 * Fill in content into the popup on load
 */
document.addEventListener("DOMContentLoaded", function () {
  getTab(tab => {
    const url = new URL(tab.url);
    sendMessage("check_if_site_disabled", url.host, disabled => {
      if(!disabled) {
        listRules(tab);
      }
      showEnableOrDisable(url, disabled);
    });
  });

  // Set up the enabled/disabled switch & hide/show rules
  updateEnabledDisabledUI();
  e('onoffswitch').addEventListener('click', toggleEnabledDisabled);
  e('http-nowhere-checkbox').addEventListener('click', toggleHttpNowhere, false);
  e('RuleManagement__see_more--prompt').addEventListener('click', toggleSeeMore);

  e('reset-to-defaults').addEventListener('click', () => {
    sendMessage("is_firefox", null, is_firefox => {
      if (is_firefox) {
        sendMessage("reset_to_defaults", null, () => {
          window.close();
        });
      } else {
        if (confirm(chrome.i18n.getMessage("prefs_reset_defaults_message"))) {
          sendMessage("reset_to_defaults", null, () => {
            window.close();
          });
        }
      }
    });
  });

  // Print the extension's current version.
  var the_manifest = chrome.runtime.getManifest();
  var version_info = e('current-version');
  version_info.innerText = the_manifest.version;

  let rulesets_versions = e('rulesets-versions');

  rulesets_versions.addSpan = function(update_channel_name, ruleset_version_string) {
    let timestamp_span = document.createElement("span");
    timestamp_span.className = "rulesets-version";
    timestamp_span.innerText = `${chrome.i18n.getMessage("about_rulesets_version")} ${update_channel_name}: ${ruleset_version_string}`;
    this.appendChild(timestamp_span);
  };

  sendMessage("get_update_channel_timestamps", null, timestamps => {
    let replaces = timestamps.some(([update_channel, timestamp]) =>
      update_channel.replaces_default_rulesets && timestamp > 0
    );
    if(!replaces) {
      rulesets_versions.addSpan("EFF (Full, Bundled)", the_manifest.version);
    }
    for(let [update_channel, timestamp] of timestamps) {
      if(timestamp > 0) {
        let ruleset_date = new Date(timestamp * 1000);
        let ruleset_version_string = ruleset_date.getUTCFullYear() + "." + (ruleset_date.getUTCMonth() + 1) + "." + ruleset_date.getUTCDate();

        rulesets_versions.addSpan(update_channel.name, ruleset_version_string);
      }
    }
  });
  e("aboutTitle").title = chrome.i18n.getMessage("about_title");
  e("add-rule-link").addEventListener("click", addManualRule);
  e("disable-on-this-site").addEventListener("click", disableOnSite);
  e("enable-on-this-site").addEventListener("click", enableOnSite);
});

var escapeForRegex = function( value ) {
  return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
};

function showEnableOrDisable(url, disabled) {
  if (["http:", "https:", "ftp:"].indexOf(url.protocol) != -1) {
    const disableLink = e("disable-on-this-site");
    const enableLink = e("enable-on-this-site");
    const addRuleSection = e("addRuleSection");
    const resetToDefaults = e('reset-to-defaults');
    if (disabled) {
      show(enableLink);
      hide(disableLink);
      hide(addRuleSection);
      hide(resetToDefaults);
    } else {
      show(disableLink);
      hide(enableLink);
    }
  } else {
    const disableEnableSection = e("disableEnableSection");
    hide(disableEnableSection);
  }
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
        /**
         * FIXME: the current implementation forbide users setting custom
         * ruleset names...
         */
        name: e("new-rule-host").value,
        target : [e("new-rule-host").value],
        rule: [{ to: e("new-rule-redirect").value, from: e("new-rule-regex").value }],
        default_off: "user rule"
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

/**
 * Disable HTTPS Everywhere on a particular FQDN
 */
function disableOnSite() {
  getTab(function(tab) {
    const url = new URL(tab.url);
    sendMessage("disable_on_site", url.host);
    chrome.tabs.reload(tab.id);
    window.close();
  });
}

function enableOnSite() {
  getTab(function(tab) {
    const url = new URL(tab.url);
    sendMessage("enable_on_site", url.host);
    chrome.tabs.reload(tab.id);
    window.close();
  });
}

/**
 * @description Turns EASE Mode on and off
 */
function toggleHttpNowhere() {
  getTab(tab => {
    getOption_('httpNowhere', false, item => {
      const enabled = !item.httpNowhere;
      setOption_('httpNowhere', enabled, () => {
        if (enabled) {
          chrome.tabs.reload(tab.id);
          e('HttpNowhere__header').innerText = chrome.i18n.getMessage("menu_encryptAllSitesEligibleOn");
          e('HttpNowhere__explained').innerText = chrome.i18n.getMessage("menu_httpNoWhereExplainedBlocked");
        } else {
          e('HttpNowhere__header').innerText = chrome.i18n.getMessage("menu_encryptAllSitesEligibleOff");
          e('HttpNowhere__explained').innerText = chrome.i18n.getMessage("menu_httpNoWhereExplainedAllowed");
        }
      });
    });
  });
}

function getTab(callback) {
  let url = new URL(window.location.href);
  if (url.searchParams.has('tabId')) {
    let parentId = Number(url.searchParams.get('tabId'));
    return chrome.tabs.get(parentId, callback);
  }
  chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => callback(tabs[0]));
}

// This code fixes a Chromium-specific bug that causes links in extension popup
// to open in regular tab even if the popup is opened in incognito mode.

document.addEventListener('click', e => {
  const { target } = e;

  if (target.matches('a[target="_blank"]')) {
    chrome.tabs.create({ url: target.href });
    e.preventDefault();
  }
});
