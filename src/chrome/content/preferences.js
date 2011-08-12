const CC = Components.classes;
const CI = Components.interfaces;
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

https_everywhere = CC["@eff.org/https-everywhere;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
o_httpsprefs = https_everywhere.get_prefs();
rulesets = https_everywhere.https_rules.rulesets;

const id_prefix = "he_enable";
const pref_prefix = "extensions.https_everywhere.";

// Disable all rules.
function disable_all() {
	for (var i in rulesets) {
		rulesets[i].disable();
	}

	treeView.treebox.invalidate();
}

// Reset all rules to their default state.
function reset_defaults() {
  for (var i in rulesets) {
    if (rulesets[i].on_by_default) {
      rulesets[i].enable();
    } else {
      rulesets[i].disable();
    }
  }

  treeView.treebox.invalidate();
}

function https_prefs_init(doc) {
  var st = document.getElementById('sites_tree');

  // GLOBAL VARIABLE!
  treeView = {
    rules: rulesets,
    rowCount: rulesets.length,
    getCellValue: function(row, col) { // site names
      if (!this.rules[row]) return;

      switch (col.id) {
        case "site_col":
          return this.rules[row].name;
        case "note_col":
          return this.rules[row].notes;
        case "enabled_col":
          var e = o_httpsprefs.getBoolPref(this.rules[row].name);
          return e ? "true" : "false";
        default:
          return;
      }
    },
    getCellText: function(row, col) { // activation indicator
       return this.getCellValue(row, col);
    },
    setCellValue: function(row, col, val) { // toggle a rule's activation
      var rule = this.rules[row];

      if (val == "true") {
        rule.enable();
      } else {
        rule.disable();
      }

      this.treebox.invalidateRow(row);
    },
    isEditable: function(row, col) {
      return (col.id == "enabled_col");
    },
    setTree: function(treebox) {
      this.treebox = treebox;
    },
    isContainer: function(row) { return false; },
    isSeparator: function(row) { return false; },
    isSorted: function() { return false; },
    getRowProperties: function(row, props) {},
    getColumnProperties: function(colid, col, props) {},
    getCellProperties: function(row, col, props) {
      var atomS = Components.classes["@mozilla.org/atom-service;1"];
        atomS = atomS.getService(Components.interfaces.nsIAtomService);

      if ( (col.id == "enabled_col") && !(this.rules[row]) ) {
        props.AppendElement( atomS.getAtom("undefined") );
      }
    },
    getLevel: function(row) { return 0; },
    getImageSrc: function(row, col) { return null; },
    search: function(query) {
      var new_rules = [];
      query = query.value.toLowerCase().replace(/^\s+|\s+$/g, "");

      for (var i in rulesets) {
        var rule_name = rulesets[i].name.toLowerCase();
        if ( rule_name.indexOf(query) != -1 ) {
          new_rules.push(rulesets[i]);
        }
      }

      this.rules = new_rules;
      this.rowCount = new_rules.length;
      this.treebox.invalidate();
      this.treebox.scrollToRow(rulesets[0]);
    }
  };

  st.view = treeView;
}

function window_opener(uri) {
  // we don't use window.open, because we need to work around TorButton's state control
    if(typeof gBrowser == "undefined"){
        var window = CC["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
        var browserWindow = window.getMostRecentWindow("navigator:browser").getBrowser();
        var newTab = browserWindow.addTab(uri, null, null);
        browserWindow.selectedTab = newTab;

    }
    else
        gBrowser.selectedTab = gBrowser.addTab(uri);
}
