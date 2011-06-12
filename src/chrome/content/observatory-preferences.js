const CC = Components.classes;
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

https_everywhere = CC["@eff.org/https-everywhere;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
o_httpsprefs = https_everywhere.get_prefs();
rulesets = https_everywhere.https_rules.rulesets;

const pref_prefix = "extensions.ssl_observatory.";

// show advanced options in the preferences dialog

function show_advanced() {
  var adv_opts_box = document.getElementById("observatory-advanced-opts");
  recursive_set(adv_opts_box, "hidden", "false");
  var toggle_button = document.getElementById("show-advanced-button");
  toggle_button.setAttribute("hidden","true");
  var toggle_button = document.getElementById("hide-advanced-button");
  toggle_button.setAttribute("hidden","false");
}

function hide_advanced() {
  var adv_opts_box = document.getElementById("observatory-advanced-opts");
  recursive_set(adv_opts_box, "hidden", "true");
  var toggle_button = document.getElementById("show-advanced-button");
  toggle_button.setAttribute("hidden","false");
  var toggle_button = document.getElementById("hide-advanced-button");
  toggle_button.setAttribute("hidden","true");
}

function recursive_set(node, attrib, value) {
  node.setAttribute(attrib, value);
  for (var i=0; i < node.childNodes.length; i++) 
    recursive_set(node.childNodes[i], attrib, value)
}
