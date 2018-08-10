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

  function onlyShowSection(sectionId){
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

  function create_update_channel_element(update_channel, pinned){
    const update_channel_div = document.createElement('div');
    update_channel_div.className = "update-channel";

    const update_channel_name = document.createElement('div');
    update_channel_name.className = "update-channel-name";
    update_channel_name.innerText = update_channel.name;
    update_channel_div.appendChild(update_channel_name);

    const update_channel_row_jwk = document.createElement('div');
    update_channel_row_jwk.className = "update-channel-row-jwk";
    update_channel_div.appendChild(update_channel_row_jwk);
    const update_channel_jwk_column_left = document.createElement('div');
    update_channel_jwk_column_left.className = "update-channel-column-left";
    update_channel_jwk_column_left.innerText = "JWK:"
    update_channel_row_jwk.appendChild(update_channel_jwk_column_left);
    const update_channel_jwk_column_right = document.createElement('div');
    update_channel_jwk_column_right.className = "update-channel-column-right";
    update_channel_row_jwk.appendChild(update_channel_jwk_column_right);
    const update_channel_jwk = document.createElement('textarea');
    update_channel_jwk.className = "update-channel-jwk";
    update_channel_jwk.setAttribute("data-name", update_channel.name);
    update_channel_jwk.disabled = pinned;
    update_channel_jwk.innerText = JSON.stringify(update_channel.jwk);
    update_channel_jwk_column_right.appendChild(update_channel_jwk);

    const update_channel_row_path_prefix = document.createElement('div');
    update_channel_row_path_prefix.className = "update-channel-row-path-prefix";
    update_channel_div.appendChild(update_channel_row_path_prefix);
    const update_channel_path_prefix_column_left = document.createElement('div');
    update_channel_path_prefix_column_left.className = "update-channel-column-left";
    update_channel_path_prefix_column_left.innerText = "Path Prefix:"
    update_channel_row_path_prefix.appendChild(update_channel_path_prefix_column_left);
    const update_channel_path_prefix_column_right = document.createElement('div');
    update_channel_path_prefix_column_right.className = "update-channel-column-right";
    update_channel_row_path_prefix.appendChild(update_channel_path_prefix_column_right);
    const update_channel_path_prefix = document.createElement('input');
    update_channel_path_prefix.setAttribute("type", "text");
    update_channel_path_prefix.className = "update-channel-path-prefix";
    update_channel_path_prefix.setAttribute("data-name", update_channel.name);
    update_channel_path_prefix.disabled = pinned;
    update_channel_path_prefix.value = update_channel.update_path_prefix;
    update_channel_path_prefix_column_right.appendChild(update_channel_path_prefix);

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
    update_channel_update.disabled = pinned;
    update_channel_update.innerText = "Update";
    update_channel_controls_column_right.appendChild(update_channel_update);
    const update_channel_delete = document.createElement('button');
    update_channel_delete.className = "update-channel-update";
    update_channel_delete.setAttribute("data-name", update_channel.name);
    update_channel_delete.disabled = pinned;
    update_channel_delete.innerText = "Delete";
    update_channel_controls_column_right.appendChild(update_channel_delete);

    const clearer = document.createElement('div');
    clearer.className = "clearer";
    update_channel_div.appendChild(clearer);

    return update_channel_div;
  }

  sendMessage("get_update_channels", defaultOptions, update_channels => {
    const update_channels_wrapper = document.getElementById("update-channels-wrapper");
    for(let update_channel of update_channels){
      update_channels_wrapper.appendChild(create_update_channel_element(update_channel, true));
    }
  });

  document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.ctrlKey && evt.keyCode == 90) {
      window.open("/pages/debugging-rulesets/index.html");
    }
  };
});
