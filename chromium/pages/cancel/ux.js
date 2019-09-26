/* global sendMessage */

"use strict";

let observer;
document.addEventListener("DOMContentLoaded", () => {
  const explainer = document.querySelector("[data-i18n=cancel_he_blocking_explainer]");
  observer = new MutationObserver(() => {
    replaceLink(explainer)
  });
  if (explainer.innerText.length > 0) {
    replaceLink(explainer);
  } else {
    observer.observe(explainer, {childList: true});
  }
  displayURL();
});

function replaceLink(explainer) {
  observer.disconnect();
  const linkText = chrome.i18n.getMessage("cancel_he_blocking_network");
  const link = document.createElement("a");
  link.href = "https://en.wikipedia.org/wiki/Downgrade_attack";
  link.innerText = linkText;
  explainer.innerHTML = explainer.innerHTML.replace(linkText, link.outerHTML);
}

function displayURL() {
  const searchParams = new URLSearchParams(window.location.search);
  const originURL = searchParams.get('originURL');
  const originURLLink = document.getElementById('url-value');
  const openURLButton = document.getElementById('open-url-button');

  originURLLink.innerText = originURL;
  originURLLink.href = originURL;

  openURLButton.addEventListener("click", function() {
    if (confirm(chrome.i18n.getMessage("chrome_disable_on_this_site") + '?')) {
      const url = new URL(originURL);
      sendMessage("disable_on_site", url.host, () => {
        window.location = originURL;
      });
    }

    return false;
  });
}
