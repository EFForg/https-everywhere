const CC = Components.classes;

function window_opener(uri) {
  // we don't use window.open, because we need to work around TorButton's state control
    if(typeof gBrowser == "undefined"){
        var window = CC["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
        var browserWindow = window.getMostRecentWindow("navigator:browser").getBrowser();
        var newTab = browserWindow.addTab(uri, null, null);
        browserWindow.selectedTab = newTab;

    }
    else
        gBrowser.selectedTab = gBrowser.addTab(uri);
}
