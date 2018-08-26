/* global sendMessage */

"use strict";

const defaultOptions = {
  showDevtoolsTab: true
};

sendMessage("get_option", defaultOptions, item => {
  if (item.showDevtoolsTab) {
    chrome.devtools.panels.create("HTTPS Everywhere",
      "/images/icons/icon-active-38.png",
      "/pages/devtools/panel.html",
      function() { }
    );
  }
});
