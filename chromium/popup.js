'use strict';

var backgroundPage = chrome.extension.getBackgroundPage();
var stableRules = null;
var unstableRules = null;
var hostReg = /.*\/\/[^$/]*\//;

const storage = chrome.storage.sync || chrome.storage.local;

/**
 * Handles rule (de)activation in the popup
 * @param checkbox checkbox being clicked
 * @param ruleset the ruleset tied tot he checkbox
 */
function toggleRuleLine(checkbox, ruleset) {
  ruleset.active = checkbox.checked;

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

  checkbox.addEventListener('change', ev => {
    toggleRuleLine(checkbox, ruleset);
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

// Change the UI to reflect extension enabled/disabled
function updateEnabledDisabledUI() {
  document.getElementById('onoffswitch').checked = backgroundPage.isExtensionEnabled;
  // Hide or show the rules sections
  if (backgroundPage.isExtensionEnabled) {
    document.body.className = ''
  } else {
    document.body.className = 'disabled'
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
    show(document.getElementById('add-rule-link'));
  }
}

/**
 * Fill in content into the popup on load
 */
document.addEventListener('DOMContentLoaded', function () {
  stableRules = document.getElementById('StableRules');
  unstableRules = document.getElementById('UnstableRules');
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
  var elem = document.querySelectorAll('[data-i18n]');
  for (let el of elem) {
    el.innerHTML = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
  }

  // other translations
  document.getElementById('aboutTitle').setAttribute('title', chrome.i18n.getMessage('about_title'));
  document.getElementById('add-rule-link').addEventListener('click', addManualRule);
});


var escapeForRegex = function( value ) {
  return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
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
  chrome.tabs.query({ active: true, currentWindow: true }, function(tab) {
    hide(document.getElementById('add-rule-link'));
    show(document.getElementById('add-new-rule-div'));
    var newUrl = document.createElement('a');
    newUrl.href = tab[0].url;
    newUrl.protocol = 'https:';
    document.getElementById('new-rule-host').value = newUrl.host;
    var oldUrl = document.createElement('a');
    oldUrl.href = tab[0].url;
    oldUrl.protocol = 'http:';
    var oldMatcher = '^' + escapeForRegex(oldUrl.protocol + '//' + oldUrl.host+ '/');
    document.getElementById('new-rule-regex').value = oldMatcher;
    var redirectPath = newUrl.protocol + '//' + newUrl.host + '/';
    document.getElementById('new-rule-redirect').value = redirectPath;
    document.getElementById('new-rule-name').value = 'Manual rule for ' + oldUrl.host;
    document.getElementById('add-new-rule-button').addEventListener('click', function() {
      var params = {
        host : document.getElementById('new-rule-host').value,
        redirectTo : document.getElementById('new-rule-redirect').value,
        urlMatcher : document.getElementById('new-rule-regex').value
      };
      backgroundPage.addNewRule(params, function() {
        location.reload();
      });
    });

    document.getElementById('cancel-new-rule').addEventListener('click', function() {
      show(document.getElementById('add-rule-link'));
      hide(document.getElementById('add-new-rule-div'));
    });
    document.getElementById('new-rule-show-advanced-link').addEventListener('click', function() {
      show(document.getElementById('new-rule-advanced'));
      hide(document.getElementById('new-rule-regular-text'));
    });
    document.getElementById('new-rule-hide-advanced-link').addEventListener('click', function() {
      hide(document.getElementById('new-rule-advanced'));
      show(document.getElementById('new-rule-regular-text'));
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
  return storage.get(details, callback);
}

function setOption_(opt, value) {
  var details = {};
  details[opt] = value;
  return storage.set(details);
}
