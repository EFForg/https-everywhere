const CC = Components.classes;
let HTTPSEverywhere = CC["@eff.org/https-everywhere;1"]
                      .getService(Components.interfaces.nsISupports)
                      .wrappedJSObject;

function exportSettingsToFile(){
  HTTPSEverywhere.exportSettingsToFile(window);
}
