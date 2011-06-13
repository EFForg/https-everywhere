window.addEventListener("load", https_everywhere_load, true);

const CI = Components.interfaces;
const CC = Components.classes;



function https_everywhere_load() {
    try {
       var firefoxnav = document.getElementById("nav-bar");
       var curSet = firefoxnav.currentSet;
       if(curSet.indexOf("https-everywhere-button") == -1) {
         var set;
         // Place the button before the urlbar
         if(curSet.indexOf("urlbar-container") != -1)
           set = curSet.replace(/urlbar-container/, "https-everywhere-button,urlbar-container");
         else  // at the end
           set = curSet + ",https-everywhere-button";
         firefoxnav.setAttribute("currentset", set);
         firefoxnav.currentSet = set;
         document.persist("nav-bar", "currentset");
         // If you don't do the following call, funny things happen
         try {
           BrowserToolboxCustomizeDone(true);
         }
         catch (e) { }
       }
    }
    catch(e) { }
}

function show_applicable_list() {
  var domWin = content.document.defaultView.top;
  if (!(domWin instanceof CI.nsIDOMWindow)) {
    alert(domWin + " is not an nsICDOMWindow");
    return null;
  }

  HTTPSEverywhere = CC["@eff.org/https-everywhere;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
  var alist = HTTPSEverywhere.getExpando(domWin.document,"applicable_rules", null);
  
  if (alist) {
    alist.log(5,"Success wherein domWin is " + domWin);
    alist.show_applicable();
    alist.populate_menu(document, alert);
  } else {
    HTTPSEverywhere.log(5,"Failure wherein domWin is " + domWin);
    var str = "Missing applicable rules for " + domWin.document.baseURIObject.spec;
    str += "\ndomWin is " + domWin;
    alert(str);
    return null;
  }
}

