"use strict";

function e(id) {
  return document.getElementById(id);
}

/**
 * Send message to main extension for HTML to display
 * @param type: enable/disable
 */
function sendMessage(type) {
  chrome.runtime.sendMessage({
    type: type,
    tabId: chrome.devtools.inspectedWindow.tabId,
  });
}

/**
 * Turn on the Switch Planner recording mode, and hide the long description.
 */
function enableSwitchPlanner() {
  sendMessage("enable");
  e("SwitchPlannerDescription").style.display = "none";
  e("SwitchPlannerDetails").style.display = "block";
  // Hack: Fetch and display summary information from background page
  // once per second.
  setInterval(display, 1000);
  chrome.devtools.inspectedWindow.reload();
}

/**
 * Disable the switch planner and reload, so any state is forgotten and
 * the long description is restored.
 */
function disableSwitchPlanner() {
  sendMessage("disable");
  document.location.reload();
}

/**
 * Fetch summary HTML of the planner results from the background page for
 * display in the devtools panel.
 */
function display() {
  chrome.runtime.sendMessage({
    type: "getHosts",
    tabId: chrome.devtools.inspectedWindow.tabId,
  }, function(response) {
    var switch_planner_details = e("SwitchPlannerDetails");
    while (switch_planner_details.firstChild) {
      switch_planner_details.removeChild(switch_planner_details.firstChild);
    }

    var nrw_text_div = document.createElement("div");
    nrw_text_div.innerText = "Unrewritten HTTP resources loaded from this tab (enable HTTPS on these domains and add them to HTTPS Everywhere):"
    var nrw_div = switchPlannerSmallHtmlSection(response.nrw);
    var rw_text_div = document.createElement("div");
    rw_text_div.style.marginTop = "20px";
    rw_text_div.innerText = "Resources rewritten successfully from this tab (update these in your source code):"
    var rw_div = switchPlannerSmallHtmlSection(response.rw);

    switch_planner_details.appendChild(nrw_text_div);
    switch_planner_details.appendChild(nrw_div);
    switch_planner_details.appendChild(rw_text_div);
    switch_planner_details.appendChild(rw_div);

    e("SwitchPlannerResults").style.display = "block";
  });
}

/**
* Format the switch planner output for presentation to a user.
* */
function switchPlannerSmallHtmlSection(asset_host_list) {
  var wrapper_div = document.createElement("div");
  if (asset_host_list.length == 0) {
    wrapper_div.style.fontWeight = "bold";
    wrapper_div.innerText = "none";
    return wrapper_div;
  }

  for (var i = asset_host_list.length - 1; i >= 0; i--) {
    var host = asset_host_list[i][3];
    var activeCount = asset_host_list[i][1];
    var passiveCount = asset_host_list[i][2];

    var div = document.createElement("div");
    var b = document.createElement("b");
    b.innerText = host;
    div.appendChild(b);

    var text_arr = [];
    if (activeCount > 0) {
      text_arr.push(activeCount + " active");
    }
    if (passiveCount > 0) {
      text_arr.push(passiveCount + " passive");
    }
    div.appendChild(document.createTextNode(": " + text_arr.join(', ')));

    wrapper_div.appendChild(div);
  }
  return wrapper_div;
}

window.onload = function() {
  // Open a connection to the background page. Right now this is only used
  // by the background page so it knows when the devtools pane has closed.
  // We don't receive messages from the background page currently, though that
  // may be a future improvement. Sending messages to the background page doesn't 
  // require an existing connection.
  chrome.runtime.connect({ name: "devtools-page" });

  var checkbox = e("SwitchPlannerCheckbox");
  checkbox.addEventListener("change", function() {
    if (checkbox.checked) {
      enableSwitchPlanner();
    } else {
      disableSwitchPlanner();
    }
  });

  e("SwitchPlannerDetailsLink").addEventListener("click", function() {
    window.open("switch-planner.html?tab=" + chrome.devtools.inspectedWindow.tabId);
  });
  // Since this is rendered in a devtools console, we have to make clicks on the
  // link open a new window.
  e("MixedContentLink").addEventListener("click", function(e) {
    window.open(e.target.href);
  });
};
