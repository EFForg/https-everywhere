var EXPORTED_SYMBOLS = ["FennecUI"];

var menuId;
var urlbarId;
var aWindow = getWindow();

function getWindow() {
  return Components.classes['@mozilla.org/appshell/window-mediator;1']
      .getService(Components.interfaces.nsIWindowMediator)
      .getMostRecentWindow('navigator:browser');
}

function loadIntoWindow() {
  if (!aWindow) {
    return;
  }
  menuId = aWindow.NativeWindow.menu.add("HTTPS Everywhere", null, function() {
    popupToggleMenu(aWindow);
  });
  urlbarId = aWindow.NativeWindow.pageactions.add(urlbarOptions);
}

function unloadFromWindow() {
  if (!aWindow) {
    return;
  }
  aWindow.NativeWindow.menu.remove(menuId);
  aWindow.NativeWindow.pageactions.remove(urlbarId);
}

function popupToggleMenu(aWindow) {
 buttons = [
   {
      label: "Yes",
      callback: function() {
        aWindow.NativeWindow.toast.show("HTTPS Everywhere disabled!", "short");
      }
    }, {
      label: "No",
      callback: function() {
      }
    }
 ]
 aWindow.NativeWindow.doorhanger.show("Would you like to turn off HTTPS Everywhere?", "doorhanger-test", buttons);
}

var urlbarOptions = {
  title: "HTTPS Everywhere",
  icon: "chrome://https-everywhere/skin/https-everywhere-128.png",
  clickCallback: function() {return;}
}

var FennecUI = {
  init: function() {
    loadIntoWindow();
  }
}
