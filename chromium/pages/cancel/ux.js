/* global sendMessage */

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
  const cancelURL = new URL(window.location.href);
  const originURL = decodeURI(cancelURL.searchParams.get('originURL'));
  displayURL(originURL);
  displayWaybackMachineLink(originURL);
});

function replaceLink(explainer){
  observer.disconnect();
  const linkText = chrome.i18n.getMessage("cancel_he_blocking_network");
  const link = document.createElement("a");
  link.href = "https://en.wikipedia.org/wiki/Downgrade_attack";
  link.innerText = linkText;
  explainer.innerHTML = explainer.innerHTML.replace(linkText, link.outerHTML);
}

function displayURL(originURL) {
  const originURLLink = document.getElementById('originURL');
  originURLLink.innerText = originURL;

  originURLLink.addEventListener("click", function() {
    if (confirm(chrome.i18n.getMessage("chrome_disable_on_this_site"))) {
      const url = new URL(originURL);
      sendMessage("disable_on_site", url.host, () => {
        window.location = originURL;
      });
    }
  });
}

function displayWaybackMachineLink(originURL) {
  const waybackMachineURLLink = document.getElementById("waybackMachineURL");
  waybackMachineURLLink.innerText = chrome.i18n.getMessage("cancel_he_blocking_internet_archive_link");
  waybackMachineURLLink.addEventListener("click", async function () {
    const response = await fetch("https://archive.org/wayback/available?url=" + encodeURI(originURL));
    const json = await response.json();
    if (json &&
        json.archived_snapshots &&
        json.archived_snapshots.closest &&
        json.archived_snapshots.closest.available) {
      // We have a snapshot! Navigate to it.
      const waybackMachineURL = json.archived_snapshots.closest.url;
      window.location = new URL(waybackMachineURL);
    } else {
      // Page is not in archive; show Wayback Machine "Not Found" page.
      window.location = new URL("https://web.archive.org/web/*/" + encodeURI(originURL));
    }
  });
}
