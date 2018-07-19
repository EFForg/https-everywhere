"use strict";

let observer;
document.addEventListener("DOMContentLoaded", () => {
  const explainer = document.querySelector("[data-i18n=cancel_he_blocking_explainer]");
  observer = new MutationObserver(() => {replaceLink(explainer)});
  if (explainer.innerText.length > 0) {
    replaceLink(explainer);
  } else {
    observer.observe(explainer, {childList: true});
  }
});

function replaceLink(explainer){
  observer.disconnect();
  const linkText = chrome.i18n.getMessage("cancel_he_blocking_network");
  const link = document.createElement("a");
  link.href = "https://en.wikipedia.org/wiki/Downgrade_attack";
  link.innerText = linkText;
  explainer.innerHTML = explainer.innerHTML.replace(linkText, link.outerHTML);
}
