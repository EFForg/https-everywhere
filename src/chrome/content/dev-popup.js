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
  HTTPSEverywhere.prefs.setBoolPref("dev_popup_shown", true);
  window.close();
}

function handle_dev_popup_error() {
  alert("OOPS! Automatic download failed; please go to https://www.eff.org/https-everywhere instead.");
}

function download_stable() {
  try {
    var tab = HTTPSEverywhere.tab_opener("https://www.eff.org/https-everywhere");
    setTimeout(function(){
      openUILinkIn("https://www.eff.org/files/https-everywhere-latest.xpi", 'current');
      window.close();
    }, 500);
  } catch(e) {
    handle_dev_popup_error();
  } finally {
    HTTPSEverywhere.prefs.setBoolPref("dev_popup_shown", true);
  }
}
