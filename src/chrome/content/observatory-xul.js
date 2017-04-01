const CC = Components.classes;
const CI = Components.interfaces;
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

var ssl_observatory = CC["@eff.org/ssl-observatory;1"]
                    .getService(Components.interfaces.nsISupports)
                    .wrappedJSObject;
var obsprefs = ssl_observatory.prefs;

const pref_prefix = "extensions.ssl_observatory.";

function observatory_prefs_init(doc) {
  // Is the Observatory on?
  var enabled = obsprefs.getBoolPref("extensions.https_everywhere._observatory.enabled");
  document.getElementById("use-observatory").checked = enabled;
  set_observatory_configurability(enabled);
  // Other settings
  document.getElementById("alt-roots").checked = 
    obsprefs.getBoolPref("extensions.https_everywhere._observatory.alt_roots");
  document.getElementById("priv-dns").checked = 
    obsprefs.getBoolPref("extensions.https_everywhere._observatory.priv_dns");
  document.getElementById("self-signed").checked = 
    obsprefs.getBoolPref("extensions.https_everywhere._observatory.self_signed");
  document.getElementById("send-asn").checked = 
    obsprefs.getBoolPref("extensions.https_everywhere._observatory.send_asn");
  document.getElementById("show-cert-warning").checked = 
    obsprefs.getBoolPref("extensions.https_everywhere._observatory.show_cert_warning");

  // More complicated: is it anonymised by Tor?
  var obs_how = doc.getElementById("ssl-obs-how");
  var anon_radio = document.getElementById("ssl-obs-anon");
  var nonanon_radio = document.getElementById("ssl-obs-nonanon");
  var anon = !obsprefs.getBoolPref(
            "extensions.https_everywhere._observatory.use_custom_proxy");

  // first set the radios to match the current settings variables
  obs_how.selectedItem = (anon) ? anon_radio : nonanon_radio;

  // But if the user hasn't turned the observatory on, 
  // the default should be the maximally sensible one
  var torbutton_avail = ssl_observatory.proxy_test_successful;
  if (!enabled) {
    set_obs_anon(torbutton_avail);
    obs_how.selectedItem = (torbutton_avail) ? anon_radio : nonanon_radio;
  }
  //scale_title_logo();
}

// The user has responded to the popup in a final way; don't show it to them
// again
function popup_done() {
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.popup_shown", true);
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.clean_config", true);
  window.close();
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
  // the "use tor" option can't be ungreyed unless tor is available
  if (ssl_observatory.proxy_test_successful == false) {
    var tor_opt = document.getElementById("ssl-obs-anon")
    tor_opt.disabled = true;
    tor_opt.label = tor_opt.getAttribute("alt_label");
  }
  if (!enabled) 
    hide_advanced();
}

// show/hide advanced options in the preferences dialog
function show_advanced() {
  var enabled = obsprefs.getBoolPref("extensions.https_everywhere._observatory.enabled");
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


function set_obs_anon(val) {
  obsprefs.setBoolPref( "extensions.https_everywhere._observatory.use_custom_proxy", !val);
}

// called from the popup only
function enable_observatory() {
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.enabled", true);
  var torbutton_avail = ssl_observatory.proxy_test_successful;
  set_obs_anon(torbutton_avail);
}

function disable_observatory() {
  // default but be sure...
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.enabled", false);
}

// called from within the prefs window, we have more work to do:
function toggle_enabled() {
  var use_obs = document.getElementById("use-observatory").checked;
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.enabled", use_obs);
  set_observatory_configurability(use_obs);
}

function toggle_send_asn() {
  var send_asn = document.getElementById("send-asn").checked;
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.send_asn", send_asn);
  if (send_asn) ssl_observatory.setupASNWatcher()
  else          ssl_observatory.stopASNWatcher();
}

function toggle_show_cert_warning() {
  var show_cert_warning = document.getElementById("show-cert-warning").checked;
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.show_cert_warning", show_cert_warning);  
}

function toggle_alt_roots() {
  var alt_roots = document.getElementById("alt-roots").checked;
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.alt_roots", alt_roots);
}

function toggle_priv_dns() {
  var priv_dns = document.getElementById("priv-dns").checked;
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.priv_dns", priv_dns);
}

function toggle_self_signed() {
  var self_signed = document.getElementById("self-signed").checked;
  obsprefs.setBoolPref("extensions.https_everywhere._observatory.self_signed", self_signed);
}

function observatory_prefs_accept() {
  // This is *horrid*, but
  // https://developer.mozilla.org/en/working_with_windows_in_chrome_code#Accessing_the_elements_of_the_top-level_document_from_a_child_window
  var outer = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIWebNavigation)
                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                   .rootTreeItem
                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindow); 

  if (outer) outer.close()
  else alert("no outer space");

  return true;  // https://developer.mozilla.org/en/XUL/dialog#a-ondialogaccept
                // also close things if there is no out meta prefs window
}

function warning_populate(warningObj) {
  // Fill in the SSL Observatory Warning labels...
  var container = document.getElementById("warning-container");
  for (var hash in warningObj) {
    var label=document.createElement("label");
    label.setAttribute("style","padding:5px 25px 5px;");
    label.textContent = warningObj[hash].long_desc;
    container.appendChild(label);
    //var spacer=document.createElement("spacer");
    //separator.setAttribute("flex","1");
    //container.appendChild(spacer);
  }
}

function show_certs() {
  var parent_win = window.arguments[1];
  var cert = window.arguments[2];
  if (!parent_win)
    alert("no parent window trying to show certs");
  CC["@mozilla.org/nsCertificateDialogs;1"]
     .getService(CI.nsICertificateDialogs)
     .viewCert(parent_win, cert);
}
