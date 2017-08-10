'use strict';

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
  sendMessage('enable');
  document.getElementById('SwitchPlannerDescription').style.display = 'none';
  document.getElementById('SwitchPlannerDetails').style.display = 'block';

  // Hack: Fetch and display summary information from background page
  // once per second.

  setInterval(update, 1000);
  chrome.devtools.inspectedWindow.reload();
}

/**
 * Disable the switch planner and reload, so any state is forgotten and
 * the long description is restored.
 */
function disableSwitchPlanner() {
  sendMessage('disable');
  document.location.reload();
}

/**
 * Fetch summary HTML of the planner results from the background page for
 * display in the devtools panel.
 */
function update() {
  chrome.runtime.sendMessage({
      type: 'getSmallHtml',
      tabId: chrome.devtools.inspectedWindow.tabId,
  }, response => {
    document.getElementById('SwitchPlannerDetails').innerHTML = response.html;
    document.getElementById('SwitchPlannerResults').style.display = 'block';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Open a connection to the background page. Right now this is only used
  // by the background page so it knows when the devtools pane has closed.
  // We don't receive messages from the background page currently, though that
  // may be a future improvement. Sending messages to the background page doesn't 
  // require an existing connection.

  chrome.runtime.connect({ name: 'devtools-page' });

  var checkbox = document.getElementById('SwitchPlannerCheckbox');

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      enableSwitchPlanner();
    } else {
      disableSwitchPlanner();
    }
  });

  document.getElementById('SwitchPlannerDetailsLink').addEventListener('click', () => {
    window.open('switch-planner.html?tab=' + chrome.devtools.inspectedWindow.tabId);
  });

  // Since this is rendered in a devtools console, we have to make clicks on the
  // link open a new window.

  document.getElementById('MixedContentLink').addEventListener('click', e => {
    window.open(e.target.href);
  });
});
