window.onload = function() {
  var backgroundPage = chrome.extension.getBackgroundPage(); 
  var hostname = document.location.search.match(/host=([^&]*)/)[1];
  document.getElementById("content").innerHTML =
    backgroundPage.switchPlannerDetailsHtml(hostname);
};

