// An ApplicableList is a structure used to keep track of which rulesets
// were applied, and which ones weren't but might have been, to the contents
// of a given page (top level nsIDOMWindow)

function ApplicableList(logger) {
  this.log = logger;
  this.active = {};
  this.inactive = {};
  this.moot={};  // rulesets that might be applicable but uris are already https
};

ApplicableList.prototype = {

  active_rule: function(ruleset) {
    this.log(WARN,"active rule " + ruleset);
    this.active[ruleset.name] = ruleset;
  },

  inactive_rule: function(ruleset) {
    this.log(WARN,"inactive rule " + ruleset);
    this.inactive[ruleset.name] = ruleset;
  },

  moot_rule: function(ruleset) {
    this.log(WARN,"moot rule " + ruleset.name);
    this.moot[ruleset.name] = ruleset;
  },


  populate_menu: function(doc, xul_popupmenu) {
    // called from the XUL when the context popup is about to be displayed;
    // fill out the UI showing which rules are active and inactive in this
    // page
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
      } else {
        this.log(WARN,"Moot rule invisible " + this.moot[x].name);
      }
    }
    this.log(WARN, "finished menu");
    
  },

  show_applicable: function() {
    for (var x in this.active) 
      this.log(WARN,"Active: " + this.active[x].name);
  
    for (x in this.inactive) 
      this.log(WARN,"Inctive: " + this.inactive[x].name);
    
  }
};

