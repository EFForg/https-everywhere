// An ApplicableList is a structure used to keep track of which rulesets
// were applied, and which ones weren't but might have been, to the contents
// of a given page (top level nsIDOMWindow)

function ApplicableList(logger) {
  this.log = logger;
};

ApplicableList.prototype = {
  active: {},
  inactive: {},

  active_rule: function(ruleset) {
    this.log(WARN,"active rule" + ruleset);
    this.active[ruleset.name] = ruleset;
  },

  inactive_rule: function(ruleset) {
    this.log(WARN,"inactive rule" + ruleset);
    this.inactive[ruleset.name] = ruleset;
  },

  populate_menu: function(doc, xul_popupmenu) {
    // called from the XUL when the context popup is about to be displayed;
    // fill out the UI showing which rules are active and inactive in this
    // page
    while (xul_popupmenu.firstChild) {
      // delete whatever was in the menu previously
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
  },

  show_applicable: function() {
    for (var x in this.active) {
      this.log(WARN,"Active: " + this.active[x].name);
    }
  
    for (x in this.inactive) {
      this.log(WARN,"Inctive: " + this.inactive[x].name);
    }
  }
};

