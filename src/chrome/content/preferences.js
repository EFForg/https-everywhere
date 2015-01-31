const CC = Components.classes;
const CI = Components.interfaces;
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

https_everywhere = CC["@eff.org/https-everywhere;1"]
  .getService(Components.interfaces.nsISupports)
  .wrappedJSObject;

rulesets = [];

const id_prefix = "he_enable";
const pref_prefix = "extensions.https_everywhere.";
const GITID = https_everywhere.https_rules.GITCommitID;

// Disable all rules.
function disable_all() {
	for (var i in rulesets) {
		rulesets[i].disable();
	}

	treeView.treebox.invalidate();
}

// Reset all rules to their default state.
function reset_defaults() {
  https_everywhere.https_rules.resetRulesetsToDefaults()
  treeView.treebox.invalidate();
}

function resetSelected() {
  var start = {};
  var end = {};
  var st = document.getElementById('sites_tree');
  var sel = st.view.selection;
  var numRanges = sel.getRangeCount();

  for (var t = 0; t < numRanges; t++){
    sel.getRangeAt(t, start, end);
    for (var v = start.value; v <= end.value; v++){
      var rs = treeView.rules[v];
      rs.clear();
    }
  }
}

function resetSelectedMenu() {
  var start = {};
  var end = {};
  var st = document.getElementById('sites_tree');
  var sel = st.view.selection;
  var numRanges = sel.getRangeCount();
  var menuitem = document.getElementById("revert_menuitem");

  for (var t = 0; t < numRanges; t++){
    sel.getRangeAt(t, start, end);
    for (var v = start.value; v <= end.value; v++){
      var rs = treeView.rules[v];
      if (rs.active !== rs.on_by_default) {
        menuitem.disabled = false;
        return;
      }
    }
  }
  menuitem.disabled = true;
}

function toggleSelected() {
  var start = {};
  var end = {};
  var st = document.getElementById('sites_tree');
  var sel = st.view.selection;
  var numRanges = sel.getRangeCount();
  var menuitem = document.getElementById("revert_menuitem");

  for (var t = 0; t < numRanges; t++){
    sel.getRangeAt(t, start, end);
    for (var v = start.value; v <= end.value; v++){
      var rs = treeView.rules[v];
      rs.toggle();
      treeView.treebox.invalidateRow(v);
    }
  }
}


function viewXMLSource() {
  var start = {};
  var end = {};
  var st = document.getElementById('sites_tree');
  var sel = st.view.selection;
  var numRanges = sel.getRangeCount();
  var menuitem = document.getElementById("revert_menuitem");

  for (var t = 0; t < numRanges; t++){
    sel.getRangeAt(t, start, end);
    for (var v = start.value; v <= end.value; v++){
      var rs = treeView.rules[v];
      
      //This *should* not violate TorButton's State Control, but someone should double check
      //this code just in case
      var aWin = CC['@mozilla.org/appshell/window-mediator;1']
      .getService(CI.nsIWindowMediator) 
      .getMostRecentWindow('navigator:browser');
      aWin.openDialog("chrome://https-everywhere/content/fetch-source.xul",
              rs.xmlName, "chrome,centerscreen", 
              {xmlName: rs.xmlName, GITCommitID: GITID} );
    }
  }
}

function getValue(row, col) {
  switch (col.id) {
    case "site_col":
      return row.name;
    case "note_col":
      return row.notes;
    case "enabled_col":
      return https_everywhere.https_rules.rulesetsByName[row.name].active;
      /*var ruleActive = false;
      try {
        if(https_everywhere.rule_toggle_prefs.getBoolPref(row.name))
          ruleActive = true;
      } catch(e) {
        ruleActive = https_everywhere.https_rules.rulesetsByName[row.name].active;
      }
      return ruleActive;*/
    default:
      return;
  }
}

function compareRules(a, b, col) {
  var aval = getValue(a, col).toLowerCase();
  var bval = getValue(b, col).toLowerCase();
  var ret = 0;
  if (aval < bval) {
    ret = -1;
  } else if (aval > bval) {
      ret = 1;
  } else {
      ret = 0;
  }
  return ret;
}

function https_prefs_init(doc) {
  var st = document.getElementById('sites_tree');
  // Note: It takes several seconds to load all the rulesets, during which time
  // Firefox is unresponsive. There are too many rulesets to reasonably browse
  // in this view anyhow. Should start with an empty window and only show
  // rulesets that match a search term the user types in.
  https_everywhere.https_rules.loadAllRulesets();
  rulesets = Array.slice(https_everywhere.https_rules.rulesets);
  // Sort the rulesets by name to avoid revealing which subset of rulesets has
  // been visited, per https://trac.torproject.org/projects/tor/ticket/11655.
  rulesets.sort(function(a, b) {
    return a.name < b.name ? -1 : 1;
  });

  // GLOBAL VARIABLE!
  treeView = {
    rules: rulesets,
    rowCount: rulesets.length,
    getCellValue: function(row, col) { // site names
      if (!this.rules[row]) return;
      return getValue(this.rules[row], col);
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
      if ( (col.id == "enabled_col") && !(this.rules[row]) ) {
        var atomS = CC["@mozilla.org/atom-service;1"];
        atomS = atomS.getService(CI.nsIAtomService);
        // Starting with 22.0a1 there is no |props| available anymore. See:
        // https://bugzilla.mozilla.org/show_bug.cgi?id=407956. Looking at the
        // patch the following seems to work, though.
        if (!props) {
          return "undefined";
        }
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
    },
    cycleHeader: function (col) {
	    var columnName;
    	var order = (col.element.getAttribute("sortDirection") === "ascending" ? -1 : 1);
    	
    	var compare = function (a, b) {
    	  return compareRules(a, b, col) * order;
  	  };
    	rulesets.sort(compare);
    	this.rules.sort(compare);
      
      var cols = st.getElementsByTagName("treecol");
      for (var i = 0; i < cols.length; i++) {
    		cols[i].removeAttribute("sortDirection");
    	}
    	col.element.setAttribute("sortDirection", order === 1 ? "ascending" : "descending");
	    this.treebox.invalidate();
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

function https_prefs_accept() {
  // This is *horrid*, but
  // https://developer.mozilla.org/en/working_with_windows_in_chrome_code#Accessing_the_elements_of_the_top-level_document_from_a_child_window
  var outer = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIWebNavigation)
                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                   .rootTreeItem
                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindow); 

  if (outer) outer.close();
  else alert("no outer space");

  return true;  // https://developer.mozilla.org/en/XUL/dialog#a-ondialogaccept
                // also close things if there is no out meta prefs window
}
