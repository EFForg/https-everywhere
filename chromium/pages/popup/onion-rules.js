function e(id) {
return document.getElementById(id);
}
  
  /**
 * Fill in content into the popup on load
 */
document.addEventListener("DOMContentLoaded", function () {
  // auto-translate all elements with i18n attributes
  var elem = document.querySelectorAll("[i18n]");
  for (var i=0; i < elem.length; i++) {
    elem[i].innerHTML = chrome.i18n.getMessage(elem[i].getAttribute("i18n"));
  }

  e("test").addEventListener("click", showRules);
});

function showRules() {
  chrome.runtime.sendMessage({type: "get_simple_rules_ending_with", object: ".tor.onion"}, rules => console.log(rules));
}