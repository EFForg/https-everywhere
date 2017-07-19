'use strict';
(function() {
  window.onload = function() {
    const backgroundPage = chrome.extension.getBackgroundPage();
    const tab = document.location.search.match(/tab=([^&]*)/)[1];
    document.getElementById('content').innerHTML =
      backgroundPage.switchPlannerDetailsHtml(tab);
  };
})();
