// An ApplicableList is a structure used to keep track of which rulesets
// were applied, and which ones weren't but might have been, to the contents
// of a given page (top level nsIDOMWindow)

serial_number = 0

function ApplicableList(logger, doc, domWin) {
  this.domWin = domWin;
  this.uri = doc.baseURIObject.clone();
  if (!this.uri) {
    this.log(WARN,"NULL CLONING URI " + doc);
    if (doc) 
      this.log(WARN,"NULL CLONING URI " + doc.baseURIObject);
    if (doc.baseURIObject) 
      this.log(WARN,"NULL CLONING URI " + doc.baseURIObject.spec);
  }
  this.home = doc.baseURIObject.spec; // what doc we're housekeeping for
  this.log = logger;
  this.active = {};
  this.breaking = {}; // rulesets with redirection loops
  this.inactive = {};
  this.moot={};  // rulesets that might be applicable but uris are already https
  this.all={};  // active + breaking + inactive + moot
  serial_number += 1;
  this.serial = serial_number;
  this.log(DBUG,"Alist serial #" + this.serial + " for " + this.home);
};

ApplicableList.prototype = {

  empty: function() {
    // Empty everything, used when toggles occur in order to ensure that if
    // the reload fails, the resulting list is not eroneous
    this.active = {};
    this.breaking = {}; 
    this.inactive = {};
    this.moot={};  
    this.all={};  
  },

  active_rule: function(ruleset) {
    this.log(INFO,"active rule " + ruleset.name +" in "+ this.home +" -> " +
             this.domWin.document.baseURIObject.spec+ " serial " + this.serial);
    this.active[ruleset.name] = ruleset;
    this.all[ruleset.name] = ruleset;
  },

  breaking_rule: function(ruleset) {
    this.log(NOTE,"breaking rule " + ruleset.name +" in "+ this.home +" -> " +
             this.domWin.document.baseURIObject.spec+ " serial " + this.serial);
    this.breaking[ruleset.name] = ruleset;
    this.all[ruleset.name] = ruleset;
  },

  inactive_rule: function(ruleset) {

    this.log(INFO,"inactive rule " + ruleset.name +" in "+ this.home +" -> " +
             this.domWin.document.baseURIObject.spec+ " serial " + this.serial);
    this.inactive[ruleset.name] = ruleset;
    this.all[ruleset.name] = ruleset;
  },

  moot_rule: function(ruleset) {
    this.log(INFO,"moot rule " + ruleset.name +" in "+ this.home + " serial " + this.serial);
    this.moot[ruleset.name] = ruleset;
    this.all[ruleset.name] = ruleset;
  },
};

