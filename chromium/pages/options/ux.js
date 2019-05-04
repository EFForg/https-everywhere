/* global sendMessage */
/* global getOption_ */
/* global e */
/* global hide */

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

  function onlyShowSection(sectionId) {
    document.querySelectorAll(".section-wrapper").forEach(sw => {
      sw.style.display = "none";
    });
    document.getElementById(sectionId).style.display = "block";
  }
  onlyShowSection("general-settings-wrapper");

  document.querySelectorAll(".section-header-span").forEach(shs => {
    shs.addEventListener("click", () => {
      document.querySelectorAll(".section-header-span").forEach(shs => {
        shs.classList.remove("active");
        shs.classList.add("inactive");
      });
      shs.classList.remove("inactive");
      shs.classList.add("active");
      onlyShowSection(shs.dataset.show);
    });
  });

  function createUpdateChannelElement(updateChannel, lastUpdated, pinned) {
    let rulesetVersionString;

    if(lastUpdated) {
      const rulesetDate = new Date(lastUpdated * 1000);
      rulesetVersionString = rulesetDate.getUTCFullYear() + "." + (rulesetDate.getUTCMonth() + 1) + "." + rulesetDate.getUTCDate();
    } else {
      rulesetVersionString = "n/a";
    }

    const updateChannelDiv = document.createElement("div");
    updateChannelDiv.className = "update-channel";

    const updateChannelName = document.createElement("div");
    updateChannelName.className = "update-channel-name";
    updateChannelName.innerText = updateChannel.name;
    updateChannelDiv.appendChild(updateChannelName);
    const updateChannelLastUpdated = document.createElement("div");
    updateChannelLastUpdated.className = "update-channel-last-updated";
    updateChannelLastUpdated.innerText = chrome.i18n.getMessage("options_storedRulesetsVersion") + rulesetVersionString;
    updateChannelName.appendChild(updateChannelLastUpdated);

    const updateChannelRowJwk = document.createElement("div");
    updateChannelRowJwk.className = "update-channel-row-jwk";
    updateChannelDiv.appendChild(updateChannelRowJwk);
    const updateChannelJwkColumnLeft = document.createElement("div");
    updateChannelJwkColumnLeft.className = "update-channel-column-left";
    updateChannelJwkColumnLeft.innerText = "JWK:";
    updateChannelRowJwk.appendChild(updateChannelJwkColumnLeft);
    const updateChannelJwkColumnRight = document.createElement("div");
    updateChannelJwkColumnRight.className = "update-channel-column-right";
    updateChannelRowJwk.appendChild(updateChannelJwkColumnRight);
    const updateChannelJwk = document.createElement("textarea");
    updateChannelJwk.className = "update-channel-jwk";
    updateChannelJwk.setAttribute("data-name", updateChannel.name);
    updateChannelJwk.disabled = pinned;
    updateChannelJwk.innerText = JSON.stringify(updateChannel.jwk);
    updateChannelJwkColumnRight.appendChild(updateChannelJwk);

    const updateChannelRowPathPrefix = document.createElement("div");
    updateChannelRowPathPrefix.className = "update-channel-row-path-prefix";
    updateChannelDiv.appendChild(updateChannelRowPathPrefix);
    const updateChannelPathPrefixColumnLeft = document.createElement("div");
    updateChannelPathPrefixColumnLeft.className = "update-channel-column-left";
    updateChannelPathPrefixColumnLeft.innerText = "Path Prefix:";
    updateChannelRowPathPrefix.appendChild(updateChannelPathPrefixColumnLeft);
    const updateChannelPathPrefixColumnRight = document.createElement("div");
    updateChannelPathPrefixColumnRight.className = "update-channel-column-right";
    updateChannelRowPathPrefix.appendChild(updateChannelPathPrefixColumnRight);
    const updateChannelPathPrefix = document.createElement("input");
    updateChannelPathPrefix.setAttribute("type", "text");
    updateChannelPathPrefix.className = "update-channel-path-prefix";
    updateChannelPathPrefix.setAttribute("data-name", updateChannel.name);
    updateChannelPathPrefix.disabled = pinned;
    updateChannelPathPrefix.value = updateChannel.update_path_prefix;
    updateChannelPathPrefixColumnRight.appendChild(updateChannelPathPrefix);

    let clearer = document.createElement("div");
    clearer.className = "clearer";
    updateChannelDiv.appendChild(clearer);

    const updateChannelRowScope = document.createElement("div");
    updateChannelRowScope.className = "update-channel-row-scope";
    updateChannelDiv.appendChild(updateChannelRowScope);
    const updateChannelScopeColumnLeft = document.createElement("div");
    updateChannelScopeColumnLeft.className = "update-channel-column-left";
    updateChannelScopeColumnLeft.innerText = "Scope:";
    updateChannelRowScope.appendChild(updateChannelScopeColumnLeft);
    const updateChannelScopeColumnRight = document.createElement("div");
    updateChannelScopeColumnRight.className = "update-channel-column-right";
    updateChannelRowScope.appendChild(updateChannelScopeColumnRight);
    const updateChannelScope = document.createElement("input");
    updateChannelScope.setAttribute("type", "text");
    updateChannelScope.className = "update-channel-scope";
    updateChannelScope.setAttribute("data-name", updateChannel.name);
    updateChannelScope.disabled = pinned;
    updateChannelScope.value = updateChannel.scope;
    updateChannelScopeColumnRight.appendChild(updateChannelScope);

    const updateChannelRowControls = document.createElement("div");
    updateChannelRowControls.className = "update-channel-row-controls";
    updateChannelDiv.appendChild(updateChannelRowControls);
    const updateChannelControlsColumnLeft = document.createElement("div");
    updateChannelControlsColumnLeft.className = "update-channel-column-left";
    updateChannelControlsColumnLeft.innerText = " ";
    updateChannelRowControls.appendChild(updateChannelControlsColumnLeft);
    const updateChannelControlsColumnRight = document.createElement("div");
    updateChannelControlsColumnRight.className = "update-channel-column-right";
    updateChannelRowControls.appendChild(updateChannelControlsColumnRight);
    const updateChannelUpdate = document.createElement("button");
    updateChannelUpdate.className = "update-channel-update";
    updateChannelUpdate.setAttribute("data-name", updateChannel.name);
    updateChannelUpdate.disabled = pinned;
    updateChannelUpdate.innerText = chrome.i18n.getMessage("options_update");
    updateChannelControlsColumnRight.appendChild(updateChannelUpdate);
    const updateChannelDelete = document.createElement("button");
    updateChannelDelete.className = "update-channel-update";
    updateChannelDelete.setAttribute("data-name", updateChannel.name);
    updateChannelDelete.disabled = pinned;
    updateChannelDelete.innerText = chrome.i18n.getMessage("options_delete");
    updateChannelControlsColumnRight.appendChild(updateChannelDelete);

    clearer = document.createElement("div");
    clearer.className = "clearer";
    updateChannelDiv.appendChild(clearer);

    updateChannelDelete.addEventListener("click", () => {
      sendMessage("delete_update_channel", updateChannel.name, () => {
        renderUpdateChannels();
      });
    });

    updateChannelUpdate.addEventListener("click", () => {
      sendMessage("update_update_channel", {
        name: updateChannel.name,
        jwk: JSON.parse(updateChannelJwk.value),
        update_path_prefix: updateChannelPathPrefix.value,
        scope: updateChannelScope.value
      }, () => {
        renderUpdateChannels();
      });
    });

    return updateChannelDiv;
  }

  function renderUpdateChannels() {
    const updateChannelsList = document.getElementById("update-channels-list");
    while(updateChannelsList.firstChild) {
      updateChannelsList.removeChild(updateChannelsList.firstChild);
    }

    sendMessage("get_pinned_update_channels", null, item => {
      for(const updateChannel of item.update_channels) {
        updateChannelsList.appendChild(
          createUpdateChannelElement(
            updateChannel,
            item.last_updated[updateChannel.name],
            true
          )
        );

      }
    });

    sendMessage("get_stored_update_channels", null, item => {
      for(const updateChannel of item.update_channels) {
        updateChannelsList.appendChild(
          createUpdateChannelElement(
            updateChannel,
            item.last_updated[updateChannel.name],
            false
          )
        );
      }
    });
  }
  renderUpdateChannels();

  const addApdateChannel = document.getElementById("add-update-channel");
  const updateChannelNameDiv = document.getElementById("update-channel-name");
  const updateChannelsErrorText = document.getElementById("update-channels-error-text");
  const updateChannelsError = document.getElementById("update-channels-error");
  updateChannelNameDiv.setAttribute("placeholder", chrome.i18n.getMessage("options_enterUpdateChannelName"));

  function displayError(text) {
    updateChannelsErrorText.innerText = text;
    updateChannelsError.style.display = "block";
    window.scrollTo(0,0);
  }

  // Get a list of user Rules
  sendMessage("get_user_rules", null, userRules => {
    const userRulesParent = e("user-rules-wrapper");

    if ( 0 === userRules.length) {
      hide(userRulesParent);
      return ;
    }

    // img element "remove button"
    const templateRemove = document.createElement("img");
    templateRemove.src = chrome.runtime.getURL("images/remove.png");
    templateRemove.className = "remove";

    for (const userRule of userRules) {
      const userRuleHost = document.createElement("div");
      const userRuleName = document.createElement("p");
      const remove = templateRemove.cloneNode(true);

      userRuleHost.className = "user-rules-list-item";
      userRuleName.className = "user-rules-list-item-single"
      userRuleName.innerText = userRule.name;
      userRuleHost.appendChild(userRuleName);
      userRulesParent.appendChild(userRuleHost);
      userRuleHost.appendChild(remove);

      remove.addEventListener("click", () => {
        // assume the removal is successful and hide ui element
        hide(userRuleHost);
        // remove the user rule
        sendMessage("remove_rule", { ruleset: userRule, src: "options" });
      });
    }
  })

  // Displays a list of disabled sites for a list of domains
  function addDisabledSite (domains) {
    const ruleHostParent = e("disabled-rules-wrapper");

    // img element "remove button"
    const templateRemove = document.createElement("img");
    templateRemove.src = chrome.runtime.getURL("images/remove.png");
    templateRemove.className = "remove";

    for (const key of domains) {
      const ruleHost = document.createElement("div");
      const remove = templateRemove.cloneNode(true);
      const ruleHostSiteName = document.createElement("p");

      ruleHost.className = "disabled-rule-list-item";
      ruleHostSiteName.className = "disabled-rule-list-item_single"
      ruleHostSiteName.innerText = key;
      ruleHost.appendChild(ruleHostSiteName);
      ruleHostParent.appendChild(ruleHost);
      ruleHost.appendChild(remove);

      remove.addEventListener("click", () => {
        hide(ruleHost);
        sendMessage("enable_on_site", key);
      });
    }
  }

  // HTTPS Everywhere Sites Disabled section in General Settings module
  getOption_("disabledList", [], function(item) {
    if (item && item.disabledList && item.disabledList.length > 0) {
      addDisabledSite(item.disabledList);
    }
  });

  // Allow user to disable HTTPSE for a site
  const addDisabledSiteBtn = document.getElementById("add-disabled-rule");
  const disabledSiteName = document.getElementById("disabled-domain-name");
  disabledSiteName.setAttribute("placeholder", chrome.i18n.getMessage("options_enterDisabledUrl"));
  addDisabledSiteBtn.addEventListener("click", () => {
    // TODO: use form submit event instead?
    const host = disabledSiteName.value;
    disabledSiteName.value = "";
    addDisabledSite([host]);
    sendMessage("disable_on_site", host);
  })

  addApdateChannel.addEventListener("click", () => {
    const updateChannelName = updateChannelNameDiv.value;
    if(updateChannelName.trim() == "") {
      displayError("Error: The update channel name is blank.  Please enter another name.");
    } else {
      updateChannelNameDiv.value = "";
      sendMessage("create_update_channel", updateChannelName, result => {
        if(result == true) {
          renderUpdateChannels();
        } else {
          displayError("Error: There already exists an update channel with this name.");
        }
      });
    }
  });

  const updateChannelsErrorHide = document.getElementById("update-channels-error-hide");
  updateChannelsErrorHide.addEventListener("click", () => {
    updateChannelsError.style.display = "none";
  });

  const updateChannelsLastChecked = document.getElementById("update-channels-last-checked");
  sendMessage("get_last_checked", null, lastChecked => {
    let lastCheckedString;
    if(lastChecked) {
      const lastCheckedDate = new Date(lastChecked * 1000);
      const options = {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
      };
      const customDateTime = new Intl.DateTimeFormat("default", options).format;
      lastCheckedString = customDateTime(lastCheckedDate);
    } else {
      lastCheckedString = chrome.i18n.getMessage("options_updatesLastCheckedNever");
    }
    updateChannelsLastChecked.innerText = chrome.i18n.getMessage("options_updatesLastChecked") + lastCheckedString;
  });

  document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.ctrlKey && evt.keyCode == 90) {
      window.open("/pages/debugging-rulesets/index.html");
    }
  };
});
