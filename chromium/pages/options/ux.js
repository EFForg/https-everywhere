/* global sendMessage */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

  const showCounter = document.getElementById("showCounter");
  const autoUpdateRulesets = document.getElementById("autoUpdateRulesets");
  const enableMixedRulesets = document.getElementById("enableMixedRulesets");
  const showDevtoolsTab = document.getElementById("showDevtoolsTab");

  const defaultOptions = {
    showCounter: true,
    autoUpdateRulesets: true,
    enableMixedRulesets: false,
    showDevtoolsTab: true
  };

  sendMessage("get_option", defaultOptions, item => {
    showCounter.checked = item.showCounter;
    autoUpdateRulesets.checked = item.autoUpdateRulesets;
    enableMixedRulesets.checked = item.enableMixedRulesets;
    showDevtoolsTab.checked = item.showDevtoolsTab;

    showCounter.addEventListener("change", () => {
      sendMessage("set_option", { showCounter: showCounter.checked });
    });

    autoUpdateRulesets.addEventListener("change", () => {
      sendMessage("set_option", { autoUpdateRulesets: autoUpdateRulesets.checked });
    });

    enableMixedRulesets.addEventListener("change", () => {
      sendMessage("set_option", { enableMixedRulesets: enableMixedRulesets.checked });
    });

    showDevtoolsTab.addEventListener("change", () => {
      sendMessage("set_option", { showDevtoolsTab: showDevtoolsTab.checked });
    });
  });

  document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.ctrlKey && evt.keyCode == 90) {
      window.open("/pages/debugging-rulesets/index.html");
    }
  };
});
