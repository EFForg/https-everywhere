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
  document.getElementById('sites_tree').height = (screen.height*0.5).toString();

  var treeView = {
    rowCount: rulesets.length,
    getCellText: function(row, col) { // site names
      return rulesets[row].name;
    },
    getCellValue: function(row, col) { // activation indicator
      return o_httpsprefs.getBoolPref(rulesets[row].name) ? "true" : "false";
    },
    setCellValue: function(row, col, val) { // toggle a rule's activation
      o_httpsprefs.setBoolPref( rulesets[row].name, (val == "true") );
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
    getCellProperties: function(row, col, props) {},
    getLevel: function(row) { return 0; },
    getImageSrc: function(row, col) { return null; }
  };

  document.getElementById('sites_tree').view = treeView;
}
