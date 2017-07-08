'use strict';
(function() {
  const backgroundPage = chrome.extension.getBackgroundPage();
  let stableRules = null;
  let unstableRules = null;
  const hostReg = /.*\/\/[^$/]*\//;
  const storage = backgroundPage.storage;

  function e(id) {
    return document.getElementById(id);
  }

  /**
   * Handles rule (de)activation in the popup
   * @param checkbox checkbox being clicked
   * @param ruleset the ruleset tied tot he checkbox
   */
  function toggleRuleLine(checkbox, ruleset) {
    ruleset.active = checkbox.checked;

    if (ruleset.active !== ruleset.defaultState) {
      localStorage[ruleset.name] = ruleset.active;
    } else {
      delete localStorage[ruleset.name];
      // purge the name from the cache so that this unchecking is persistent.
      backgroundPage.allRules.ruleCache.delete(ruleset.name);
    }
    // Now reload the selected tab of the current window.
    chrome.tabs.reload();
  }

  /**
   * Creates a rule line (including checkbox and icon) for the popup
   * @param ruleset the ruleset to build the line for
   * @returns {*}
   */
  function appendRuleLineToListDiv(ruleset, listDiv) {
    // parent block for line
    const line = document.createElement('div');
    line.className = 'rule checkbox';

    // label "container"
    const label = document.createElement('label');

    // checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    if (ruleset.active) {
      checkbox.setAttribute('checked', '');
    }
    checkbox.onchange = function(ev) {
      toggleRuleLine(checkbox, ruleset);
    };
    label.appendChild(checkbox);

    // favicon (from chrome's cache)
    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.src = 'chrome://favicon/';
    for (let i = 0; i < ruleset.rules.length; i++) {
      const host = hostReg.exec(ruleset.rules[i].to);
      if (host) {
        favicon.src += host[0];
        break;
      }
    }
    const xhr = new XMLHttpRequest();
    try {
      xhr.open('GET', favicon.src, true);
      label.appendChild(favicon);
    } catch (e) {}

    // label text
    const text = document.createElement('span');
    text.innerText = ruleset.name;
    if (ruleset.note.length) {
      text.title = ruleset.note;
    }

    if (ruleset.note === 'user rule') {
      const remove = document.createElement('img');
      remove.src = chrome.extension.getURL('remove.png');
      remove.className = 'remove';
      line.appendChild(remove);

      remove.addEventListener('click', function() {
        backgroundPage.removeRule(ruleset);
        listDiv.removeChild(line);
      });
    }

    label.appendChild(text);

    line.appendChild(label);

    listDiv.appendChild(line);
  }

  // Change the UI to reflect extension enabled/disabled
  function updateEnabledDisabledUI() {
    document.getElementById('onoffswitch').checked = backgroundPage.isExtensionEnabled;
    // Hide or show the rules sections
    if (backgroundPage.isExtensionEnabled) {
      document.body.className = '';
    } else {
      document.body.className = 'disabled';
    }
    backgroundPage.updateState();
  }

  // Toggle extension enabled/disabled status
  function toggleEnabledDisabled() {
    if (backgroundPage.isExtensionEnabled) {
      // User wants to disable us
      backgroundPage.isExtensionEnabled = false;
    } else {
      // User wants to enable us
      backgroundPage.isExtensionEnabled = true;
    }
    updateEnabledDisabledUI();
    // The extension state changed, so reload this tab.
    chrome.tabs.reload();
    window.close();
  }

  /**
   * Create the list of rules for a specific tab
   * @param tabArray
   */
  function gotTab(tabArray) {
    const activeTab = tabArray[0];
    const rulesets = backgroundPage.activeRulesets.getRulesets(activeTab.id);

    for (const r of rulesets.keys) {
      let listDiv = stableRules;
      if (!rulesets[r].defaultState) {
        listDiv = unstableRules;
      }
      appendRuleLineToListDiv(rulesets[r], listDiv);
      listDiv.style.position = 'static';
      listDiv.style.visibility = 'visible';
    }
    // Only show the "Add a rule" link if we're on an HTTPS page
    if (/^https:/.test(activeTab.url)) {
      show(e('add-rule-link'));
    }
  }

  /**
   * Fill in content into the popup on load
   */
  document.addEventListener('DOMContentLoaded', function() {
    stableRules = document.getElementById('StableRules');
    unstableRules = document.getElementById('UnstableRules');
    chrome.tabs.query({active: true, currentWindow: true}, gotTab);

    // Set up the enabled/disabled switch & hide/show rules
    updateEnabledDisabledUI();
    document.getElementById('onoffswitch').addEventListener('click', toggleEnabledDisabled);

    // Print the extension's current version.
    const manifest = chrome.runtime.getManifest();
    const versionInfo = document.getElementById('current-version');
    versionInfo.innerText = manifest.version;

    // Set up toggle checkbox for HTTP nowhere mode
    getOption('httpNowhere', false, function(item) {
      const httpNowhereCheckbox = document.getElementById('http-nowhere-checkbox');
      httpNowhereCheckbox.addEventListener('click', toggleHttpNowhere, false);
      const httpNowhereEnabled = item.httpNowhere;
      if (httpNowhereEnabled) {
        httpNowhereCheckbox.setAttribute('checked', '');
      }
    });

    // auto-translate all elements with i18n attributes
    const elem = document.querySelectorAll('[i18n]');
    for (let i = 0; i < elem.length; i++) {
      elem[i].innerHTML = chrome.i18n.getMessage(elem[i].getAttribute('i18n'));
    }

    // other translations
    e('aboutTitle').setAttribute('title', chrome.i18n.getMessage('about_title'));
    e('add-rule-link').addEventListener('click', addManualRule);
  });

  const escapeForRegex = function(value) {
    return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  };

  function hide(elem) {
    elem.style.display = 'none';
  }

  function show(elem) {
    elem.style.display = 'block';
  }

  /**
   * Handles the manual addition of rules
   */
  function addManualRule() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tab) {
      hide(e('add-rule-link'));
      show(e('add-new-rule-div'));
      const newUrl = document.createElement('a');
      newUrl.href = tab[0].url;
      newUrl.protocol = 'https:';
      e('new-rule-host').value = newUrl.host;
      const oldUrl = document.createElement('a');
      oldUrl.href = tab[0].url;
      oldUrl.protocol = 'http:';
      const oldMatcher = '^' + escapeForRegex(oldUrl.protocol + '//' + oldUrl.host + '/');
      e('new-rule-regex').value = oldMatcher;
      const redirectPath = newUrl.protocol + '//' + newUrl.host + '/';
      e('new-rule-redirect').value = redirectPath;
      e('new-rule-name').value = 'Manual rule for ' + oldUrl.host;
      e('add-new-rule-button').addEventListener('click', function() {
        const params = {
          host: e('new-rule-host').value,
          redirectTo: e('new-rule-redirect').value,
          urlMatcher: e('new-rule-regex').value,
        };
        backgroundPage.addNewRule(params);
        location.reload();
      });

      e('cancel-new-rule').addEventListener('click', function() {
        show(e('add-rule-link'));
        hide(e('add-new-rule-div'));
      });
      e('new-rule-show-advanced-link').addEventListener('click', function() {
        show(e('new-rule-advanced'));
        hide(e('new-rule-regular-text'));
      });
      e('new-rule-hide-advanced-link').addEventListener('click', function() {
        hide(e('new-rule-advanced'));
        show(e('new-rule-regular-text'));
      });
    });
  }

  function toggleHttpNowhere() {
    getOption('httpNowhere', false, function(item) {
      setOption('httpNowhere', !item.httpNowhere);
    });
  }

  function getOption(opt, defaultOpt, callback) {
    const details = {};
    details[opt] = defaultOpt;
    return storage.get(details, callback);
  }

  function setOption(opt, value) {
    const details = {};
    details[opt] = value;
    return storage.set(details);
  }
})();
