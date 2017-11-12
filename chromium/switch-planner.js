"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const background = chrome.extension.getBackgroundPage().require('./background');
  var tab = document.location.search.match(/tab=([^&]*)/)[1];
  var content = document.getElementById("content");

  var nrw_text_div = document.createElement("div");
  nrw_text_div.innerText = "Unrewritten HTTP resources loaded from this tab (enable HTTPS on these domains and add them to HTTPS Everywhere):"
  var nrw_div = switchPlannerDetailsHtmlSection(
    background.sortSwitchPlanner(tab, "nrw"),
    background.switchPlannerInfo[tab]["nrw"]
  );
  var rw_text_div = document.createElement("div");
  rw_text_div.style.marginTop = "20px";
  rw_text_div.innerText = "Resources rewritten successfully from this tab (update these in your source code):"
  var rw_div = switchPlannerDetailsHtmlSection(
    background.sortSwitchPlanner(tab, "rw"),
    background.switchPlannerInfo[tab]["rw"]
  );

  content.appendChild(nrw_text_div);
  content.appendChild(nrw_div);
  content.appendChild(rw_text_div);
  content.appendChild(rw_div);
});

/**
 * Generate the detailed html fot the switch planner, by section
 * */
function switchPlannerDetailsHtmlSection(asset_host_list, link_keys) {
  var wrapper_div = document.createElement("div");
  if (asset_host_list.length == 0) {
    wrapper_div.style.fontWeight = "bold";
    wrapper_div.innerText = "none";
    return wrapper_div;
  }

  for (var i = asset_host_list.length - 1; i >= 0; i--) {
    var host = asset_host_list[i][3];
    var activeCount = asset_host_list[i][1];
    var passiveCount = asset_host_list[i][2];

    var div = document.createElement("div");
    div.style.marginTop = "20px";
    var b = document.createElement("b");
    b.innerText = host;
    div.appendChild(b);

    if (activeCount > 0) {
      var active_div = document.createElement("div");
      active_div.appendChild(document.createTextNode(activeCount + " active"));
      for (const link of linksFromKeys(link_keys[host][1])) {
        active_div.appendChild(link);
      }
      div.appendChild(active_div);
    }
    if (passiveCount > 0) {
      var passive_div = document.createElement("div");
      passive_div.appendChild(document.createTextNode(passiveCount + " passive"));
      for (const link of linksFromKeys(link_keys[host][0])) {
        passive_div.appendChild(link);
      }
      div.appendChild(passive_div);
    }
    wrapper_div.appendChild(div);
  }
  return wrapper_div;
}

/**
 * Generate a HTML link from urls in map
 * map: the map containing the urls
 * */
function linksFromKeys(map) {
  if (typeof map == 'undefined') return "";
  var links = [];
  for (var key in map) {
    if (map.hasOwnProperty(key)) {
      var link = document.createElement("a");
      link.style.display = "block";
      link.href = key;
      link.innerText = key;
      links.push(link);
    }
  }
  return links;
}
