const CC = Components.classes;
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

ssl_observatory = CC["@eff.org/ssl-observatory;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
obsprefs = ssl_observatory.prefs;

const pref_prefix = "extensions.ssl_observatory.";

function observatory_prefs_init(doc) {

  var enabled = obsprefs.getBoolPref(
                 "extensions.https_everywhere._observatory_prefs.enabled");
  doc.getElementById("use-observatory").checked = enabled;
  // These radio options are only available if the observatory is enabled
  toggle_observatory_configurability(enabled);
}

function toggle_observatory_configurability(enabled) {
  var ui_elements = document.querySelectorAll(".ssl-obs-conf");
  for (var i =0; i < ui_elements.length; i++) 
    ui_elements[i].disabled = !enabled;
}
// show advanced options in the preferences dialog

function show_advanced() {
  var adv_opts_box = document.getElementById("observatory-advanced-opts");
  recursive_set(adv_opts_box, "hidden", "false");
  document.getElementById("show-advanced-button")
          .setAttribute("hidden","true");
  document.getElementById("hide-advanced-button")
          .setAttribute("hidden","false");
}

function hide_advanced() {
  var adv_opts_box = document.getElementById("observatory-advanced-opts");
  recursive_set(adv_opts_box, "hidden", "true");
  document.getElementById("show-advanced-button")
          .setAttribute("hidden","false");
  document.getElementById("hide-advanced-button")
          .setAttribute("hidden","true");
}

function recursive_set(node, attrib, value) {
  node.setAttribute(attrib, value);
  for (var i=0; i < node.childNodes.length; i++) 
    recursive_set(node.childNodes[i], attrib, value)
}

function toggle_enabled() {
  var checkbox = document.getElementById("use-observatory");
  var use_obs = checkbox.checked;

  obsprefs.setBoolPref("extensions.https_everywhere._observatory_prefs.enabled",
                       use_obs);

  toggle_observatory_configurability(use_obs);
}
