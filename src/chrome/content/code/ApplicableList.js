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

  show_applicable: function() {
    for (var x in this.active) {
      this.log(WARN,"Active: " + this.active[x].name);
    }
  
    for (x in this.inactive) {
      this.log(WARN,"Inctive: " + this.inactive[x].name);
    }
  }
};

