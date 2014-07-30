var backgroundPage = null;
var stableRules = null;
var unstableRules = null;
var hostReg = /.*\/\/[^$/]*\//;

function e(id) {
  return document.getElementById(id);
}

function toggleRuleLine(checkbox, ruleset) {
  ruleset.active = checkbox.checked;

  if (ruleset.active != ruleset.default_state) {
    localStorage[ruleset.name] = ruleset.active;
  } else {
    delete localStorage[ruleset.name];
  }
  // Now reload the selected tab of the current window.
  chrome.tabs.reload();
}

function createRuleLine(ruleset) {

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
    toggleRuleLine(checkbox, ruleset);
  };
  label.appendChild(checkbox);

  // favicon (from chrome's cache)
  var favicon = document.createElement("img");
  favicon.src = "chrome://favicon/";
  for (var i=0; i < ruleset.rules.length; i++) {
    var host = hostReg.exec(ruleset.rules[i].to);
    if (host) {
      favicon.src += host[0];
      break;
    }
  }
  label.appendChild(favicon);

  // label text
  var text = document.createElement("span");
  text.innerText = ruleset.name;
  if (ruleset.note.length) {
    text.title = ruleset.note;
  }
  label.appendChild(text);

  line.appendChild(label);

  return line;
}

function gotTab(tab) {
  var rulesets = backgroundPage.activeRulesets.getRulesets(tab.id);

  for (var r in rulesets) {
    var listDiv = stableRules;
    if (!rulesets[r].default_state) {
      listDiv = unstableRules;
    }
    listDiv.appendChild(createRuleLine(rulesets[r]));
    listDiv.style.position = "static";
    listDiv.style.visibility = "visible";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  backgroundPage = chrome.extension.getBackgroundPage();
  stableRules = document.getElementById("StableRules");
  unstableRules = document.getElementById("UnstableRules");
  chrome.tabs.getSelected(null, gotTab);

  // auto-translate all elements with i18n attributes
  var elem = document.querySelectorAll("[i18n]");
  for (var i=0; i < elem.length; i++) {
    elem[i].innerHTML = chrome.i18n.getMessage(elem[i].getAttribute("i18n"));
  }

  // other translations
  e("whatIsThis").setAttribute("title", chrome.i18n.getMessage("chrome_what_is_this_title"));
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

function addManualRule() {
  chrome.tabs.getSelected(null, function(tab) {
    hide(e("add-rule-link"));
    show(e("add-new-rule-div"));
    var newUrl = new URI(tab.url);
    newUrl.scheme("https");
    e("new-rule-host").value = newUrl.host();
    var oldUrl = new URI(tab.url);
    oldUrl.scheme("http");
    var oldMatcher = "^" + escapeForRegex(oldUrl.scheme() + "://" + oldUrl.host() + "/");
    e("new-rule-regex").value = oldMatcher;
    var redirectPath = newUrl.scheme() + "://" + newUrl.host() + "/";
    e("new-rule-redirect").value = redirectPath;
    e("new-rule-name").value = "Manual rule for " + oldUrl.host();
    e("add-new-rule-button").addEventListener("click", function() {
      var params = {
        host : e("new-rule-host").value,
        redirectTo : e("new-rule-redirect").value,
        urlMatcher : e("new-rule-regex").value
      };
      backgroundPage.addNewRule(params, function() {
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
