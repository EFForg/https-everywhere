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
  set_observatory_configurability(enabled);
  //scale_title_logo();
}

function scale_title_logo() {
  // The image is naturally 500x207, but if it's shrunk we don't want it 
  // distorted
  var img = document.getElementById("obs-title-logo");
  alert("ch is " + img.height);
  if (img.height != "207")
    img.width = (500.0/207.0) * img.height;
}

// grey/ungrey UI elements that control observatory operation
function set_observatory_configurability(enabled) {
  // the relevant widgets are tagged with class="ssl-obs-conf"
  var ui_elements = document.querySelectorAll(".ssl-obs-conf");
  for (var i =0; i < ui_elements.length; i++) 
    ui_elements[i].disabled = !enabled;
  if (!enabled) 
    hide_advanced();
}

// show/hide advanced options in the preferences dialog
function show_advanced() {
  var enabled = obsprefs.getBoolPref(
                 "extensions.https_everywhere._observatory_prefs.enabled");
  if (enabled) {
    var adv_opts_box = document.getElementById("observatory-advanced-opts");
    recursive_set(adv_opts_box, "hidden", "false");
    document.getElementById("show-advanced-button").hidden = true;
    document.getElementById("hide-advanced-button").hidden = false;
  }
  //scale_title_logo();
}
function hide_advanced() {
  var adv_opts_box = document.getElementById("observatory-advanced-opts");
  recursive_set(adv_opts_box, "hidden", "true");
  document.getElementById("show-advanced-button").hidden = false;
  document.getElementById("hide-advanced-button").hidden = true;
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

  set_observatory_configurability(use_obs);
}
