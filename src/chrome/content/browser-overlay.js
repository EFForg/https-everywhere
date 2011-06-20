var HTTPSEverywhereMenu = {
  onLoad: function() {
    // initialization code
    this.initialized = true;
  },

  onPreferences: function() {
    window.open("chrome://https-everywhere/content/preferences.xul", "",
    "chrome,centerscreen");
  },
  
  onSSLObservatoryPopup: function() {
    window.open("chrome://https-everywhere/content/observatory-popup.xul", "",
    "chrome,centerscreen");
  },

  onSSLObservatory: function() {
    window.open("chrome://https-everywhere/content/observatory-preferences.xul",
    "", "chrome,centerscreen");
  },

  onAbout: function() {
    window.open("chrome://https-everywhere/content/about.xul", "",
    "chrome,centerscreen");
  },

  onMeta: function() {
    window.open("chrome://https-everywhere/content/meta-preferences.xul", "",
    "chrome,centerscreen");
  }
};

window.addEventListener("load", function(e) { HTTPSEverywhereMenu.onLoad(e); }, false); 
