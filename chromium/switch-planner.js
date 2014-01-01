window.onload = function() {
  var backgroundPage = chrome.extension.getBackgroundPage(); 
  var tab = document.location.search.match(/tab=([^&]*)/)[1];
  document.getElementById("content").innerHTML =
    backgroundPage.switchPlannerDetailsHtml(tab);
};

