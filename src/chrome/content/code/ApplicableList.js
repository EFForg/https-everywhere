// An ApplicableList is a structure used to keep track of which rulesets
// were applied, and which ones weren't but might have been, to the contents
// of a given page (top level nsIDOMWindow)

serial_number = 0

function ApplicableList(logger, home) {
  this.home = home.baseURIObject.spec; // what doc we're housekeeping for
  this.log = logger;
  this.active = {};
  this.inactive = {};
  this.moot={};  // rulesets that might be applicable but uris are already https
  serial_number += 1;
  this.serial = serial_number;
  this.log(WARN,"Alist serial #" + this.serial);
};

ApplicableList.prototype = {

  active_rule: function(ruleset) {
    this.log(WARN,"active rule " + ruleset.name +" in "+ this.home);
    this.active[ruleset.name] = ruleset;
  },

  inactive_rule: function(ruleset) {
    this.log(WARN,"inactive rule " + ruleset.name +" in "+ this.home);
    this.inactive[ruleset.name] = ruleset;
  },

  moot_rule: function(ruleset) {
    this.log(WARN,"moot rule " + ruleset.name +" in "+ this.home);
    this.moot[ruleset.name] = ruleset;
  },

  dom_handler: function(operation,key,data,src,dst) {
    // See https://developer.mozilla.org/En/DOM/UserDataHandler
    if (src && dst) 
      dst.setUserData(key, data, this.dom_handler);
  },

  populate_menu: function(doc, xul_popupmenu) {
    // called from the XUL when the context popup is about to be displayed;
    // fill out the UI showing which rules are active and inactive in this
    // page
    this.log(WARN, "populating using alist #" + this.serial);
    while (xul_popupmenu.firstChild) {
      // delete whatever was in the menu previously
      //this.log(WARN,"removing " + xul_popupmenu.firstChild.label +" from menu");
      xul_popupmenu.removeChild(xul_popupmenu.firstChild);
    }

    for (var x in this.active) {
      var item = doc.createElement("menuitem");
      item.setAttribute("label",this.active[x].name);
      xul_popupmenu.appendChild(item);
    }
    for (var x in this.inactive) {
      var item = doc.createElement("menuitem");
      item.setAttribute("label",this.inactive[x].name);
      xul_popupmenu.appendChild(item);
    }

    for (var x in this.moot) {
      if (! (x in this.active) ) {
        // rules that are active for some uris are not really moot
        var item = doc.createElement("menuitem");
        item.setAttribute("label","moot " + this.moot[x].name);
        xul_popupmenu.appendChild(item);
      } else {
        this.log(WARN,"Moot rule invisible " + this.moot[x].name);
      }
    }
    this.log(WARN, "finished menu");
    
  },

  show_applicable: function() {
    this.log(WARN, "Applicable list number " + this.serial);
    for (var x in this.active) 
      this.log(WARN,"Active: " + this.active[x].name);
  
    for (x in this.inactive) 
      this.log(WARN,"Inactive: " + this.inactive[x].name);

    for (x in this.moot) 
      this.log(WARN,"Moot: " + this.moot[x].name);
    
  }
};

