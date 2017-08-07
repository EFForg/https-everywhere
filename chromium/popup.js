'use strict';

var backgroundPage = chrome.extension.getBackgroundPage();
var stableRules = null;
var unstableRules = null;
var hostReg = /.*\/\/[^$/]*\//;

const storage = chrome.storage.sync || chrome.storage.local;

function setRulesetActive(ruleset, active) {
  ruleset.active = active;

  if (ruleset.active != ruleset.default_state) {
    localStorage[ruleset.name] = ruleset.active;
  } else {
    delete localStorage[ruleset.name];
    // purge the name from the cache so that this unchecking is persistent.
    backgroundPage.all_rules.ruleCache.delete(ruleset.name);
  }
  // Now reload the selected tab of the current window.
  chrome.tabs.reload();
}

/**
 * Creates a rule line (including checkbox and icon) for the popup
 * @param ruleset the ruleset to build the line for
 * @returns {*}
 */
function appendRuleLineToListDiv(ruleset, list_div) {
  // parent block for line
  var line = document.createElement('div');
  line.className = 'rule checkbox';

  // label 'container'
  var label = document.createElement('label');

  // checkbox
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = ruleset.active;

  checkbox.addEventListener('change', () => {
    setRulesetActive(ruleset, checkbox.checked);
  });

  label.appendChild(checkbox);

  // favicon (from chrome's cache)
  var favicon = document.createElement('img');
  favicon.className = 'favicon';

  for (let rule of ruleset.rules) {
    var host = hostReg.exec(rule.to);
    if (host) {
      favicon.src = 'chrome://favicon/https://' + host[0];
      break;
    }
  }

  label.appendChild(favicon);

  // label text
  var text = document.createElement('span');
  text.innerText = ruleset.name;

  if (ruleset.note.length) {
    text.title = ruleset.note;
  }

  if(ruleset.note == 'user rule') {
    var remove = document.createElement('img');
    remove.src = chrome.extension.getURL('remove.png');
    remove.className = 'remove';
    line.appendChild(remove);

    remove.addEventListener('click', function(){
      backgroundPage.removeRule(ruleset);
      list_div.removeChild(line);
    });
  }

  label.appendChild(text);
  line.appendChild(label);
  list_div.appendChild(line);
}

/**
 * Fill in content into the popup on load
 */
document.addEventListener('DOMContentLoaded', function () {
  stableRules = document.getElementById('StableRules');
  unstableRules = document.getElementById('UnstableRules');
  chrome.tabs.query({ active: true, currentWindow: true }, tabArray => {
    var activeTab = tabArray[0];
    var rulesets = backgroundPage.activeRulesets.getRulesets(activeTab.id);

    for (var r in rulesets) {
      var listDiv = stableRules;
      if (!rulesets[r].default_state) {
        listDiv = unstableRules;
      }
      appendRuleLineToListDiv(rulesets[r], listDiv);
      listDiv.style.position = 'static';
      listDiv.style.visibility = 'visible';
    }
    // Only show the 'Add a rule' link if we're on an HTTPS page
    if (/^https:/.test(activeTab.url)) {
      document.getElementById('add-rule-link').style.display = 'block';
    }
  });

  // Set up the enabled/disabled switch & hide/show rules
  document.getElementById('onoffswitch').checked = backgroundPage.isExtensionEnabled;

  // Hide or show the rules sections
  if (backgroundPage.isExtensionEnabled) {
    document.body.className = ''
  } else {
    document.body.className = 'disabled'
  }

  document.getElementById('onoffswitch').addEventListener('change', evt => {
    // The extension state changed, so reload this tab.
    backgroundPage.updateState();

    chrome.tabs.reload();
    window.close();
  });

  // Print the extension's current version.
  document.getElementById('current-version').innerText = chrome.runtime.getManifest().version;

  // Set up toggle checkbox for HTTP nowhere mode
  getOption_('httpNowhere', false, item => {
    var httpNowhereCheckbox = document.getElementById('http-nowhere-checkbox');
    httpNowhereCheckbox.checked = item.httpNowhere;
    httpNowhereCheckbox.addEventListener('change', toggleHttpNowhere, false);
  });

  // auto-translate all elements with data-i18n attributes
  var elements = document.querySelectorAll('[data-i18n]');
  for (const element of elements) {
    el.innerText = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
  }

  // other translations
  document.getElementById('aboutTitle').setAttribute('title', chrome.i18n.getMessage('about_title'));
  document.getElementById('add-rule-link').addEventListener('click', addManualRule);
});

/**
 * Handles the manual addition of rules
 */
function addManualRule() {
  chrome.tabs.query({ active: true, currentWindow: true }, tab => {
    const url = new URL(tab[0].url);
    document.getElementById('add-new-rule-div').style.display = 'block';
    document.getElementById('add-rule-link').style.display = 'none';
    document.getElementById('new-rule-host').value = url.host;
    document.getElementById('new-rule-regex').value = '^http:';
    document.getElementById('new-rule-redirect').value = 'https:';
    document.getElementById('new-rule-name').value = 'Manual rule for ' + url.host;
    document.getElementById('add-new-rule-button').addEventListener('click', () => {
      backgroundPage.addNewRule({
        host : document.getElementById('new-rule-host').value,
        redirectTo : document.getElementById('new-rule-redirect').value,
        urlMatcher : document.getElementById('new-rule-regex').value
      }, () => {
        location.reload();
      });
    });

    document.getElementById('cancel-new-rule').addEventListener('click', () => {
      document.getElementById('add-rule-link').style.display = 'block';
      document.getElementById('add-new-rule-div').style.display = 'none';
    });
    document.getElementById('new-rule-show-advanced-link').addEventListener('click', () => {
      document.getElementById('new-rule-advanced').style.display = 'block';
      document.getElementById('new-rule-regular-text').style.display = 'none';
    });
    document.getElementById('new-rule-hide-advanced-link').addEventListener('click', () => {
      document.getElementById('new-rule-regular-text').style.display = 'block';
      document.getElementById('new-rule-advanced').style.display = 'none';
    });
  });
}

function getOption_(opt, defaultOpt, callback) {
  var details = {};
  details[opt] = defaultOpt;
  return storage.get(details, callback);
}

function setOption_(opt, value) {
  var details = {};
  details[opt] = value;
  return storage.set(details);
}
