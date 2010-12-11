const CC = Components.classes;
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

function https_prefs_init(doc) {
  var st = document.getElementById('sites_tree');
  st.height = (screen.height*0.7).toString();
  // GLOBAL VARIABLE!
  treeView = {
    rules: rulesets,
    rowCount: rulesets.length,
    getCellText: function(row, col) { // site names
      if (!this.rules[row]) return;
      return this.rules[row].name;
    },
    getCellValue: function(row, col) { // activation indicator
      if (!this.rules[row]) return;
      return o_httpsprefs.getBoolPref(this.rules[row].name) ? "true" : "false";
    },
    setCellValue: function(row, col, val) { // toggle a rule's activation
      var rule = this.rules[row];
      var active = (val == "true");

      o_httpsprefs.setBoolPref(rule.name, active);
      rule.active = active;

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
    }
  };

  st.view = treeView;
}
