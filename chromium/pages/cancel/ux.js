/* global sendMessage */

"use strict";

let observer;
document.addEventListener("DOMContentLoaded", () => {
  const explainer = document.querySelector("[data-i18n=cancel_he_blocking_explainer]");
  observer = new MutationObserver(() => {
    replaceLink(explainer);
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
  link.classList.add("wikilink");
  link.href = "https://en.wikipedia.org/wiki/Downgrade_attack";
  link.innerText = linkText;
  explainer.innerHTML = explainer.innerHTML.replace(linkText, link.outerHTML);

  /*
    In response to translation of i18n string "cancel_he_blocking_network".
    Within context of the paragraph and as a standalone string can be interpreted differently
    langauge to language.

    So if link fails to swap in replace, this conditional is triggered
  */
  if (document.getElementsByClassName("wikilink").length === 0) {
    link.innerText = linkText;
    explainer.after(link);
  }

}

function displayURL() {
  const searchParams = new URLSearchParams(window.location.search);
  const originURL = searchParams.get('originURL');
  const originURLLink = document.getElementById('url-value');
  const openURLButton = document.getElementById('open-url-button');
  const openHttpOnce = document.getElementById('http-once-button');
  const copyButton = document.getElementById('copy-url');
  const url = new URL(originURL);

  originURLLink.innerText = originURL;
  originURLLink.href = originURL;

  openURLButton.addEventListener("click", function() {
    if (confirm(chrome.i18n.getMessage("chrome_disable_on_this_site") + '?')) {
      sendMessage("disable_on_site", url.host, () => {
        window.location = originURL;
      });
    }

    return false;
  });

  // Copy URL Feature on EASE
  copyButton.addEventListener("click", async event => {
    copyButton.innerText = 'Copy URL';
    if (!navigator.clipboard) {
      // Clipboard API not available
      return
    }
    try {
      await navigator.clipboard.writeText(originURL);
      copyButton.innerText = chrome.i18n.getMessage("cancel_copied_url");
    } catch (err) {
      console.log(err);
      console.log('failed');
    }
  });

  openHttpOnce.addEventListener("click", function() {
    if (confirm(chrome.i18n.getMessage("chrome_disable_on_this_site") + '?')) {
      sendMessage("disable_on_site_once", url.host, () => {
        window.location = originURL;
      });
    }

    return false;
  });
}
