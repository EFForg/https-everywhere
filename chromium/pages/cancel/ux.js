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
    if (confirm(chrome.i18n.getMessage("cancel_open_page") + '?')) {
      sendMessage("disable_on_site", url.host, () => {
        window.location = originURL;
      });
    }

    return false;
  });

  // Copy URL Feature on EASE

  function copyLinkAlternate() {
    let isSuccessful = false;

    const sel = window.getSelection();

    try {
      sel.removeAllRanges();

      const range = document.createRange();
      range.selectNode(originURLLink);

      sel.addRange(range);

      isSuccessful = document.execCommand("copy");

      sel.removeAllRanges();

      return isSuccessful;
    } catch (err) {
      console.error(err);

      sel.removeAllRanges();

      return false;
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(originURL);
      return true;
    } catch (err) {
      return copyLinkAlternate();
    }
  }

  let restoreTimeout = null;

  copyButton.addEventListener("click", async () => {
    if (await copyLink()) {
      copyButton.innerText = chrome.i18n.getMessage("cancel_copied_url");

      if (restoreTimeout !== null) {
        clearTimeout(restoreTimeout);
      }

      restoreTimeout = setTimeout(() => {
        copyButton.innerText = chrome.i18n.getMessage("cancel_copy_url");
        restoreTimeout = null;
      }, 1500);
    }
  });

  openHttpOnce.addEventListener("click", function() {
    if (confirm(chrome.i18n.getMessage("cancel_http_once") + '?')) {
      sendMessage("disable_on_site_once", url.host, () => {
        window.location = originURL;
      });
    }

    return false;
  });
}
