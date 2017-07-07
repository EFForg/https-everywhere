'use strict'
;(function () {
  window.onload = function () {
    let backgroundPage = chrome.extension.getBackgroundPage()
    let tab = document.location.search.match(/tab=([^&]*)/)[1]
    document.getElementById('content').innerHTML =
      backgroundPage.switchPlannerDetailsHtml(tab)
  }
})()
