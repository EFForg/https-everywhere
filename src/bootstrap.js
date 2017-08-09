"use strict";

const CI = Components.interfaces;
const CC = Components.classes;

function get_prefs(branch_name){
  let o_prefs = CC["@mozilla.org/preferences-service;1"]
                      .getService(CI.nsIPrefService);
  let o_branch = o_prefs.getBranch(branch_name);
  return o_branch;
}

function get_custom_rulesets_array(){
  var loc = "ProfD";  // profile directory
  var dir =
    CC["@mozilla.org/file/directory_service;1"]
    .getService(CI.nsIProperties)
    .get(loc, CI.nsILocalFile)
    .clone();
  dir.append("HTTPSEverywhereUserRules");
  // Check for existence, if not, create.
  if (!dir.exists()) {
    return [];
  }

  var entries = dir.directoryEntries;
  var files = [];
  while(entries.hasMoreElements()) {
    var entry = entries.getNext();
    entry.QueryInterface(CI.nsIFile);
    files.push(entry);
  }

  let file_data = []
  for(let file of files){
    var data = "";
    var fstream = CC["@mozilla.org/network/file-input-stream;1"]
        .createInstance(CI.nsIFileInputStream);
    var sstream = CC["@mozilla.org/scriptableinputstream;1"]
        .createInstance(CI.nsIScriptableInputStream);
    fstream.init(file, -1, 0, 0);
    sstream.init(fstream);

    var str = sstream.read(4096);
    while (str.length > 0) {
      data += str;
      str = sstream.read(4096);
    }

    sstream.close();
    fstream.close();
    file_data.push(data);
  }

  return file_data;
}

function startup({webExtension}) {
  webExtension.startup().then(api => {
    const {browser} = api;
    browser.runtime.onMessage.addListener((msg, sender, sendReply) => {
      if (msg == "import-legacy-data") {
        let globals = get_prefs("extensions.https_everywhere.");
        let prefs_array = globals.getChildList("", {});
        if(~prefs_array.indexOf("webextensions-migrated") ? !globals.getBoolPref("webextensions-migrated") : true){
          let rules = get_prefs("extensions.https_everywhere.rule_toggle.");

          let changed = false;

          let prefs = {
            http_nowhere_enabled:  ~prefs_array.indexOf("http_nowhere.enabled") ? globals.getBoolPref("http_nowhere.enabled") : false,
            global_enabled: ~prefs_array.indexOf("globalEnabled") ? globals.getBoolPref("globalEnabled") : true,
            show_counter:  ~prefs_array.indexOf("show_counter") ? globals.getBoolPref("show_counter") : true
          };

          if(prefs.http_nowhere_enabled == true ||
            prefs.global_enabled == false ||
            prefs.show_counter == true
          ){
            changed = true;
          }

          let rule_toggle = {}
          for(let rule_toggle_key of rules.getChildList("", {})){
            rule_toggle[rule_toggle_key]  = rules.getBoolPref(rule_toggle_key);
            changed = true;
          }

          let custom_rulesets = get_custom_rulesets_array();
          if(custom_rulesets.length > 0){
            changed = true;
          }

          sendReply({
            prefs: prefs,
            rule_toggle: rule_toggle,
            custom_rulesets: custom_rulesets,
            changed: changed
          });

          globals.setBoolPref("webextensions-migrated", true);
        } else {
          sendReply({changed: false});
        }
      }
    });
  });
}

function shutdown(data) {
}
