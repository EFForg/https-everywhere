/* global sendMessage */
/* global getOption_ */
/* global e */
/* global show, hide */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const secretArea = document.getElementById('secretArea');

  const onKeyDownHandler = evt => {
    if (evt.ctrlKey && evt.key === 'z') {
      secretArea.classList.remove('hidden');
      secretArea.classList.add('flash');

      sendMessage('set_option', { developerMode: true });

      document.removeEventListener('keydown', onKeyDownHandler);

      evt.preventDefault();
    }
  };

  sendMessage('get_option', { developerMode: false }, item => {
    if (item.developerMode) {
      secretArea.classList.remove('hidden');
    } else {
      document.addEventListener('keydown', onKeyDownHandler);
    }
  });

  const autoUpdateRulesets = document.getElementById("autoUpdateRulesets");
  const enableMixedRulesets = document.getElementById("enableMixedRulesets");
  const showDevtoolsTab = document.getElementById("showDevtoolsTab");

  const defaultOptions = {
    autoUpdateRulesets: true,
    enableMixedRulesets: false,
    showDevtoolsTab: true
  };

  sendMessage("get_option", defaultOptions, item => {
    autoUpdateRulesets.checked = item.autoUpdateRulesets;
    enableMixedRulesets.checked = item.enableMixedRulesets;
    showDevtoolsTab.checked = item.showDevtoolsTab;

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
    document.querySelectorAll('.section-wrapper').forEach(sw => {
      sw.style.display = "none";
    });
    document.getElementById(sectionId).style.display = "block";
  }
  onlyShowSection('general-settings-wrapper');

  document.querySelectorAll('.section-header-span').forEach(shs => {
    shs.addEventListener("click", () => {
      document.querySelectorAll('.section-header-span').forEach(shs => {
        shs.classList.remove("active");
        shs.classList.add("inactive");
      });
      shs.classList.remove("inactive");
      shs.classList.add("active");
      onlyShowSection(shs.dataset.show);
    });
  });

  function create_update_channel_element(update_channel, last_updated, locked) {
    let ruleset_version_string;

    if(last_updated) {
      const ruleset_date = new Date(last_updated * 1000);
      ruleset_version_string = ruleset_date.getUTCFullYear() + "." + (ruleset_date.getUTCMonth() + 1) + "." + ruleset_date.getUTCDate();
    } else {
      ruleset_version_string = "n/a";
    }

    const update_channel_div = document.createElement('div');
    update_channel_div.className = "update-channel";

    const update_channel_name = document.createElement('div');
    update_channel_name.className = "update-channel-name";
    update_channel_name.innerText = update_channel.name;
    update_channel_div.appendChild(update_channel_name);
    const update_channel_last_updated = document.createElement('div');
    update_channel_last_updated.className = "update-channel-last-updated";
    update_channel_last_updated.innerText = chrome.i18n.getMessage("options_storedRulesetsVersion") + ruleset_version_string;
    update_channel_name.appendChild(update_channel_last_updated);

    const update_channel_row_format = document.createElement('div');
    update_channel_row_format.className = "update-channel-row-format";
    update_channel_div.appendChild(update_channel_row_format);
    const update_channel_format_column_left = document.createElement('div');
    update_channel_format_column_left.className = "update-channel-column-left";
    update_channel_format_column_left.innerText = "Format:";
    update_channel_row_format.appendChild(update_channel_format_column_left);
    const update_channel_format_column_right = document.createElement('div');
    update_channel_format_column_right.className = "update-channel-column-right";
    update_channel_row_format.appendChild(update_channel_format_column_right);
    const update_channel_format = document.createElement('select');
    update_channel_format.className = "update-channel-format";
    update_channel_format.setAttribute("data-name", update_channel.name);
    update_channel_format.disabled = locked;
    update_channel_format_column_right.appendChild(update_channel_format);
    const update_channel_format_option_ruleset = document.createElement('option');
    update_channel_format_option_ruleset.value = "ruleset";
    update_channel_format_option_ruleset.innerText = "ruleset";
    update_channel_format_option_ruleset.defaultSelected = true;
    update_channel_format_option_ruleset.selected = (update_channel.format == "ruleset");
    update_channel_format.appendChild(update_channel_format_option_ruleset);
    const update_channel_format_option_bloom = document.createElement('option');
    update_channel_format_option_bloom.value = "bloom";
    update_channel_format_option_bloom.innerText = "bloom";
    update_channel_format_option_bloom.selected = (update_channel.format == "bloom");
    update_channel_format.appendChild(update_channel_format_option_bloom);

    const update_channel_row_jwk = document.createElement('div');
    update_channel_row_jwk.className = "update-channel-row-jwk";
    update_channel_div.appendChild(update_channel_row_jwk);
    const update_channel_jwk_column_left = document.createElement('div');
    update_channel_jwk_column_left.className = "update-channel-column-left";
    update_channel_jwk_column_left.innerText = "JWK:";
    update_channel_row_jwk.appendChild(update_channel_jwk_column_left);
    const update_channel_jwk_column_right = document.createElement('div');
    update_channel_jwk_column_right.className = "update-channel-column-right";
    update_channel_row_jwk.appendChild(update_channel_jwk_column_right);
    const update_channel_jwk = document.createElement('textarea');
    update_channel_jwk.className = "update-channel-jwk";
    update_channel_jwk.setAttribute("data-name", update_channel.name);
    update_channel_jwk.disabled = locked;
    update_channel_jwk.innerText = JSON.stringify(update_channel.jwk);
    update_channel_jwk_column_right.appendChild(update_channel_jwk);

    const update_channel_row_path_prefix = document.createElement('div');
    update_channel_row_path_prefix.className = "update-channel-row-path-prefix";
    update_channel_div.appendChild(update_channel_row_path_prefix);
    const update_channel_path_prefix_column_left = document.createElement('div');
    update_channel_path_prefix_column_left.className = "update-channel-column-left";
    update_channel_path_prefix_column_left.innerText = "Path Prefix:";
    update_channel_row_path_prefix.appendChild(update_channel_path_prefix_column_left);
    const update_channel_path_prefix_column_right = document.createElement('div');
    update_channel_path_prefix_column_right.className = "update-channel-column-right";
    update_channel_row_path_prefix.appendChild(update_channel_path_prefix_column_right);
    const update_channel_path_prefix = document.createElement('input');
    update_channel_path_prefix.setAttribute("type", "text");
    update_channel_path_prefix.className = "update-channel-path-prefix";
    update_channel_path_prefix.setAttribute("data-name", update_channel.name);
    update_channel_path_prefix.disabled = locked;
    update_channel_path_prefix.value = update_channel.update_path_prefix;
    update_channel_path_prefix_column_right.appendChild(update_channel_path_prefix);

    let clearer = document.createElement('div');
    clearer.className = "clearer";
    update_channel_div.appendChild(clearer);

    const update_channel_row_scope = document.createElement('div');
    if(update_channel.format == "bloom") {
      update_channel_row_scope.style.display = "none";
    }
    update_channel_row_scope.className = "update-channel-row-scope";
    update_channel_div.appendChild(update_channel_row_scope);
    const update_channel_scope_column_left = document.createElement('div');
    update_channel_scope_column_left.className = "update-channel-column-left";
    update_channel_scope_column_left.innerText = "Scope:";
    update_channel_row_scope.appendChild(update_channel_scope_column_left);
    const update_channel_scope_column_right = document.createElement('div');
    update_channel_scope_column_right.className = "update-channel-column-right";
    update_channel_row_scope.appendChild(update_channel_scope_column_right);
    const update_channel_scope = document.createElement('input');
    update_channel_scope.setAttribute("type", "text");
    update_channel_scope.className = "update-channel-scope";
    update_channel_scope.setAttribute("data-name", update_channel.name);
    update_channel_scope.disabled = locked;
    update_channel_scope.value = update_channel.scope;
    update_channel_scope_column_right.appendChild(update_channel_scope);

    const update_channel_row_controls = document.createElement('div');
    update_channel_row_controls.className = "update-channel-row-controls";
    update_channel_div.appendChild(update_channel_row_controls);
    const update_channel_controls_column_left = document.createElement('div');
    update_channel_controls_column_left.className = "update-channel-column-left";
    update_channel_controls_column_left.innerText = " ";
    update_channel_row_controls.appendChild(update_channel_controls_column_left);
    const update_channel_controls_column_right = document.createElement('div');
    update_channel_controls_column_right.className = "update-channel-column-right";
    update_channel_row_controls.appendChild(update_channel_controls_column_right);
    const update_channel_update = document.createElement('button');
    update_channel_update.className = "update-channel-update";
    update_channel_update.setAttribute("data-name", update_channel.name);
    update_channel_update.disabled = locked;
    update_channel_update.innerText = chrome.i18n.getMessage("options_update");
    update_channel_controls_column_right.appendChild(update_channel_update);
    const update_channel_delete = document.createElement('button');
    update_channel_delete.className = "update-channel-update";
    update_channel_delete.setAttribute("data-name", update_channel.name);
    update_channel_delete.disabled = locked;
    update_channel_delete.innerText = chrome.i18n.getMessage("options_delete");
    update_channel_controls_column_right.appendChild(update_channel_delete);

    clearer = document.createElement('div');
    clearer.className = "clearer";
    update_channel_div.appendChild(clearer);

    update_channel_format.addEventListener("change", () => {
      if(update_channel_format.value == "bloom") {
        update_channel_row_scope.style.display = "none";
      } else {
        update_channel_row_scope.style.display = "block";
      }
    });
    update_channel_delete.addEventListener("click", () => {
      sendMessage("delete_update_channel", update_channel.name, () => {
        render_update_channels();
      });
    });

    update_channel_update.addEventListener("click", () => {
      sendMessage("update_update_channel", {
        name: update_channel.name,
        format: update_channel_format.value,
        jwk: JSON.parse(update_channel_jwk.value),
        update_path_prefix: update_channel_path_prefix.value,
        scope: update_channel_scope.value
      }, () => {
        render_update_channels();
      });
    });

    return update_channel_div;
  }

  function render_update_channels() {
    const update_channels_list = document.getElementById("update-channels-list");
    while(update_channels_list.firstChild) {
      update_channels_list.removeChild(update_channels_list.firstChild);
    }

    sendMessage("get_pinned_update_channels", null, item => {
      for(const update_channel of item.update_channels) {
        update_channels_list.appendChild(
          create_update_channel_element(
            update_channel,
            item.last_updated[update_channel.name],
            true,
          )
        );

      }
    });

    sendMessage("get_stored_update_channels", null, item => {
      for(const update_channel of item.update_channels) {
        update_channels_list.appendChild(
          create_update_channel_element(
            update_channel,
            item.last_updated[update_channel.name],
            update_channel.locked === true,
          )
        );
      }
    });
  }
  render_update_channels();

  const add_update_channel = document.getElementById("add-update-channel");
  const update_channel_name_div = document.getElementById("update-channel-name");
  const update_channels_error_text = document.getElementById("update-channels-error-text");
  const update_channels_error = document.getElementById("update-channels-error");
  update_channel_name_div.setAttribute("placeholder", chrome.i18n.getMessage("options_enterUpdateChannelName"));

  function displayError(text) {
    update_channels_error_text.innerText = text;
    update_channels_error.style.display = "block";
    window.scrollTo(0,0);
  }

  // Get a list of user Rules
  sendMessage("get_user_rules", null, userRules => {
    let user_rules_parent = e("user-rules-wrapper");

    if ( 0 === userRules.length) {
      hide(user_rules_parent);
      return ;
    }

    // img element "remove button"
    let templateRemove = document.createElement("img");
    templateRemove.src = chrome.runtime.getURL("images/remove.png");
    templateRemove.className = "remove";

    for (const userRule of userRules) {
      let user_rule_host = document.createElement("div");
      let user_rule_name = document.createElement("p");
      let remove = templateRemove.cloneNode(true);

      user_rule_host.className = "user-rules-list-item";
      user_rule_name.className = "user-rules-list-item-single";
      user_rule_name.innerText = userRule.name;
      user_rule_host.appendChild(user_rule_name);
      user_rules_parent.appendChild(user_rule_host);
      user_rule_host.appendChild(remove);

      remove.addEventListener("click", () => {
        // assume the removal is successful and hide ui element
        hide( user_rule_host );
        // remove the user rule
        sendMessage("remove_rule", { ruleset: userRule, src: 'options' });
      });
    }
  });

  // HTTPS Everywhere Sites Disabled section in General Settings module
  getOption_("disabledList", [], function(item) {
    let rule_host_parent = e("disabled-rules-wrapper");

    // img element "remove button"
    let templateRemove = document.createElement("img");
    templateRemove.src = chrome.runtime.getURL("images/remove.png");
    templateRemove.className = "remove";

    if( item ) {
      for (const key of item.disabledList) {
        let rule_host = document.createElement("div");
        let remove = templateRemove.cloneNode(true);
        let rule_host_site_name = document.createElement("p");

        rule_host.className = "disabled-rule-list-item";
        rule_host_site_name.className = "disabled-rule-list-item_single";
        rule_host_site_name.innerText = key;
        rule_host.appendChild( rule_host_site_name);
        rule_host_parent.appendChild(rule_host);
        rule_host.appendChild(remove);

        remove.addEventListener("click", () => {
          hide( rule_host );
          sendMessage("enable_on_site", key);
        });
      }
    }
  });

  const add_disabled_site = document.getElementById("add-disabled-site");
  const disabled_site_input = document.getElementById("disabled-site");
  const add_disabled_site_invalid_host = document.getElementById('add-disabled-site-invalid-host');
  disabled_site_input.setAttribute("placeholder", chrome.i18n.getMessage("options_enterDisabledSite"));
  function isValidHost(host) {
    try {
      new URL(`http://${host}/`);
      return true;
    } catch {
      return false;
    }
  }
  add_disabled_site.addEventListener("click", function() {
    const host = disabled_site_input.value;

    if (isValidHost(host)) {
      hide(add_disabled_site_invalid_host);
      sendMessage("disable_on_site", disabled_site_input.value, okay => {
        if (okay) {
          chrome.tabs.reload();
        }
      });
    } else {
      show(add_disabled_site_invalid_host);
    }
  });

  add_update_channel.addEventListener("click", () => {
    const update_channel_name = update_channel_name_div.value;
    if(update_channel_name.trim() == "") {
      displayError("Error: The update channel name is blank.  Please enter another name.");
    } else {
      update_channel_name_div.value = "";
      sendMessage("create_update_channel", update_channel_name, result => {
        if(result == true) {
          render_update_channels();
        } else {
          displayError("Error: There already exists an update channel with this name.");
        }
      });
    }
  });

  const update_channels_error_hide = document.getElementById("update-channels-error-hide");
  update_channels_error_hide.addEventListener("click", () => {
    update_channels_error.style.display = "none";
  });

  const update_channels_last_checked = document.getElementById("update-channels-last-checked");
  sendMessage("get_last_checked", null, last_checked => {
    let last_checked_string;
    if(last_checked) {
      const last_checked_date = new Date(last_checked * 1000);
      const options = {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      };
      const customDateTime = new Intl.DateTimeFormat('default', options).format;
      last_checked_string = customDateTime(last_checked_date);
    } else {
      last_checked_string = chrome.i18n.getMessage("options_updatesLastCheckedNever");
    }
    update_channels_last_checked.innerText = chrome.i18n.getMessage("options_updatesLastChecked") + last_checked_string;
  });
});
