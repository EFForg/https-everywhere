window.addEventListener("load", https_everywhere_load, true);

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


