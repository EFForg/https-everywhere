const CI = Components.interfaces;
const CC = Components.classes;

// LOG LEVELS ---
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                      .getService(Components.interfaces.nsISupports)
                      .wrappedJSObject;

function dev_popup_done() {
//  HTTPSEverywhere.prefs.setBoolPref("dev_popup_shown", true);
  window.close();
}

function download_stable() {
  try {
    HTTPSEverywhere.tab_opener("https://www.eff.org/files/https-everywhere-latest.xpi");
  } catch(e) {
    alert("OOPS! Automatic download failed; please go to https://www.eff.org/https-everywhere instead.");
  }
}
