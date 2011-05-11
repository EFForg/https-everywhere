var HTTPSEverywhereMenu = {
  onLoad: function() {
    // initialization code
    this.initialized = true;
  },

  onPreferences: function() {
    window.open("chrome://https-everywhere/content/preferences.xul", "", "chrome");
  },
  
  onSSLObservatoryPopup: function() {
    window.open("chrome://https-everywhere/content/observatory-popup.xul", "", "chrome");
  },

  onSSLObservatory: function() {
    window.open("chrome://https-everywhere/content/observatory-preferences.xul", "", "chrome");
  },

  onAbout: function() {
    window.open("chrome://https-everywhere/content/about.xul", "", "chrome");
  }
};

window.addEventListener("load", function(e) { HTTPSEverywhereMenu.onLoad(e); }, false); 
