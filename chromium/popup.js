var backgroundPage = null;
var stableRules = null;
var unstableRules = null;

function toggleRuleLine(checkbox, ruleset) {
  ruleset.active = checkbox.checked;

  if (ruleset.active != ruleset.default_state) {
    localStorage[ruleset.name] = ruleset.active;
  } else {
    delete localStorage[ruleset.name];
  }
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
  checkbox.checked = ruleset.active;
  checkbox.onchange = function(ev) { toggleRuleLine(checkbox, ruleset); };

  // label text
  var labelText = document.createElement("span");
  labelText.innerText = ruleset.name;
  if (ruleset.note.length) {
    labelText.title = ruleset.note;
  }

  label.appendChild(checkbox);
  label.appendChild(labelText);
  line.appendChild(label);

  return line;
}

function gotTab(tab) {
  var rulesets = backgroundPage.activeRulesets.getRulesets(tab.id);

  for (r in rulesets) {
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
  var e = document.querySelectorAll("[i18n]");
  for (var i=0; i < e.length; i++) {
    e[i].innerHTML = chrome.i18n.getMessage(e[i].getAttribute("i18n"));
  }

  // other translations
  document.getElementById("whatIsThis").setAttribute("title", chrome.i18n.getMessage("chrome_what_is_this_title"));
});

