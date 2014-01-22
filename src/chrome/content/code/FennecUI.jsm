var EXPORTED_SYMBOLS = ["FennecUI"];

var menuId;

function getWindow() {
  return Components.classes['@mozilla.org/appshell/window-mediator;1']
      .getService(Components.interfaces.nsIWindowMediator)
      .getMostRecentWindow('navigator:browser');
}

function loadIntoWindow() {
  var window = getWindow();
  menuId = window.NativeWindow.menu.add("HTTPS Everywhere", null, function() {
    popupMenu(window);
  });
}

function unloadFromWindow() {
  var window = getWindow();
  window.NativeWindow.menu.remove(menuId);
}

function popupMenu(window) {
 window.console.log('https everywhere');
}

var FennecUI = {
  init: function() {
    loadIntoWindow();
  }
}
