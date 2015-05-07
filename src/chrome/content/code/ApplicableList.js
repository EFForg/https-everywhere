// An ApplicableList is a structure used to keep track of which rulesets
// were applied, and which ones weren't but might have been, to the contents
// of a given page (top level nsIDOMWindow)

var serial_number = 0;

function ApplicableList(logger, uri) {
  this.log = logger;
  this.uri = uri.clone();
  if (!this.uri) {
    this.log(WARN,"NULL CLONING URI " + doc);
    if (uri) {
      this.log(WARN,"NULL CLONING URI " + uri.spec);
    }
  }
  this.home = uri.spec; // what doc we're housekeeping for
  this.active = {};
  this.breaking = {}; // rulesets with redirection loops
  this.inactive = {};
  this.moot={};  // rulesets that might be applicable but uris are already https
  this.all={};  // active + breaking + inactive + moot
  serial_number += 1;
  this.serial = serial_number;
  this.log(DBUG,"Alist serial #" + this.serial + " for " + this.home);
}

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
             this.uri.spec+ " serial " + this.serial);
    this.active[ruleset.name] = ruleset;
    this.all[ruleset.name] = ruleset;
  },

  breaking_rule: function(ruleset) {
    this.log(NOTE,"breaking rule " + ruleset.name +" in "+ this.home +" -> " +
             this.uri.spec+ " serial " + this.serial);
    this.breaking[ruleset.name] = ruleset;
    this.all[ruleset.name] = ruleset;
  },

  inactive_rule: function(ruleset) {

    this.log(INFO,"inactive rule " + ruleset.name +" in "+ this.home +" -> " +
             this.uri.spec+ " serial " + this.serial);
    this.inactive[ruleset.name] = ruleset;
    this.all[ruleset.name] = ruleset;
  },

  moot_rule: function(ruleset) {
    this.log(INFO,"moot rule " + ruleset.name +" in "+ this.home + " serial " + this.serial);
    this.moot[ruleset.name] = ruleset;
    this.all[ruleset.name] = ruleset;
  },

  dom_handler: function(operation,key,data,src,dst) {
    // See https://developer.mozilla.org/En/DOM/UserDataHandler
    if (src && dst) 
      dst.setUserData(key, data, this.dom_handler);
  },

  populate_list: function() {
    // The base URI of the dom tends to be loaded from some /other/
    // ApplicableList, so pretend we're loading it from here.
    HTTPSEverywhere.instance.https_rules.rewrittenURI(this, this.uri);
    this.log(DBUG, "populating using alist #" + this.serial);
  },

  populate_menu: function(document, menupopup, weird) {
    this.populate_list();
    this.document = document;
    
    var https_everywhere = CC["@eff.org/https-everywhere;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;   
   
    // get the menu popup
    this.menupopup = menupopup;

    // empty it all of its menuitems
    while(this.menupopup.firstChild.tagName != "menuseparator") {
      this.menupopup.removeChild(this.menupopup.firstChild);
    }
    
    // add global enable/disable toggle button  
    var strings = document.getElementById("HttpsEverywhereStrings");
    
    var enableLabel = document.createElement('menuitem');
    var text = strings.getString("https-everywhere.menu.globalDisable");
    if(!https_everywhere.prefs.getBoolPref("globalEnabled"))
      text = strings.getString("https-everywhere.menu.globalEnable");
        
    enableLabel.setAttribute('label', text);
    enableLabel.setAttribute('command', 'https-everywhere-menuitem-globalEnableToggle');    
    this.prepend_child(enableLabel);
    
    // add the label at the top
    var any_rules = false;
    for(var x in this.all) {
      any_rules = true;  // how did JavaScript get this ugly?
      break;
    }
    var label = document.createElement('menuitem');
    label.setAttribute('label', strings.getString('https-everywhere.menu.enableDisable'));
    label.setAttribute('command', 'https-everywhere-menuitem-preferences');
    var label2 = false;
    if (!any_rules) {
      label2 = document.createElement('menuitem');
      if (!weird) text = strings.getString('https-everywhere.menu.noRules');
      else        text = strings.getString('https-everywhere.menu.unknownRules');
      label2.setAttribute('label', text);
      label2.setAttribute('command', 'https-everywhere-menuitem-preferences');
      label2.setAttribute('style', 'color:#909090;');
    }

    // create a commandset if it doesn't already exist
    this.commandset = document.getElementById('https-everywhere-commandset');
    if(!this.commandset) {
      this.commandset = document.createElement('commandset');
      this.commandset.setAttribute('id', 'https-everywhere-commandset');
      var win = document.getElementById('main-window');
      win.appendChild(this.commandset);
    } else {
      // empty commandset
      while(this.commandset.firstChild) 
        this.commandset.removeChild(this.commandset.firstChild);
    }

    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
                     
    var browser = wm.getMostRecentWindow("navigator:browser").gBrowser.selectedBrowser;
    var location = browser.currentURI.asciiSpec; //full url, including about:certerror details
    
    if(location.substr(0, 6) == "about:"){
      //"From" portion of the rule is retrieved from the location bar via document.getElementById("urlbar").value
        
      var fromHost = document.getElementById("urlbar").value;  
      
      //scheme must be trimmed out to check for applicable rulesets       
      if(fromHost.indexOf("://") != -1)
        fromHost = fromHost.substr(fromHost.indexOf("://") + 3, fromHost.length);
          
      //trim off any page locations - we only want the host - e.g. domain.com
      if(fromHost.indexOf("/") != -1)
        fromHost = fromHost.substr(0, fromHost.indexOf("/"));
                     
      // Search for applicable rulesets for the host listed in the location bar
      var plist = HTTPSRules.potentiallyApplicableRulesets(fromHost);     
      for (var i = 0 ; i < plist.length ; i++){
        //For each applicable rulset, determine active/inactive, and append to proper list.
        var ruleOn = false;
        try {
          if(https_everywhere.rule_toggle_prefs.getBoolPref(plist[i].name))
            ruleOn = true;
        } catch(e) {
          if(https_everywhere.https_rules.rulesetsByName[plist[i].name].active)
            ruleOn = true;
        }
        if(ruleOn)
          this.active_rule(plist[i]);
        else
          this.inactive_rule(plist[i]);                   
      }   
    }   
    
    // add all applicable commands
    for(var x in this.breaking) 
      this.add_command(this.breaking[x]); 
    for(var x in this.active) 
      this.add_command(this.active[x]); 
    for(var x in this.moot)
      this.add_command(this.moot[x]);
    for(var x in this.inactive) 
      this.add_command(this.inactive[x]);

    if(https_everywhere.prefs.getBoolPref("globalEnabled")){
       // add all the menu items
       for (var x in this.inactive)
          this.add_menuitem(this.inactive[x], 'inactive');
       // rules that are active for some uris are not really moot
       for (var x in this.moot) 
          if (!(x in this.active))   
              this.add_menuitem(this.moot[x], 'moot');
       // break once break everywhere
       for (var x in this.active) 
          if (!(x in this.breaking))
              this.add_menuitem(this.active[x], 'active');
       for (var x in this.breaking)
          this.add_menuitem(this.breaking[x], 'breaking');
          
       if (label2) this.prepend_child(label2);
       this.prepend_child(label);
    }
    
  },

  prepend_child: function(node) {
    this.menupopup.insertBefore(node, this.menupopup.firstChild);
  },

  add_command: function(rule) {
      var command = this.document.createElement("command");
      command.setAttribute('id', JSON.stringify(rule.id)+'-command');
      command.setAttribute('label', rule.name);
      command.setAttribute('oncommand', 'toggle_rule("'+JSON.stringify(rule.id)+'")');
      this.commandset.appendChild(command);
  },

  // add a menu item for a rule -- type is "active", "inactive", "moot",
  // or "breaking"

  add_menuitem: function(rule, type) {
    // create the menuitem
    var item = this.document.createElement('menuitem');
    item.setAttribute('command', rule.id+'-command');
    item.setAttribute('class', type+'-item menuitem-iconic');
    item.setAttribute('label', rule.name);

    // we can get confused if rulesets have their state changed after the
    // ApplicableList was constructed
    if (!rule.active && (type == 'active' || type == 'moot'))
      type = 'inactive';
    if (rule.active && type == 'inactive')
      type = 'moot';
    
    // set the icon
    var image_src;
    if (type == 'active') image_src = 'tick.png';
    else if (type == 'inactive') image_src = 'cross.png';
    else if (type == 'moot') image_src = 'tick-moot.png';
    else if (type == 'breaking') image_src = 'loop.png';
    item.setAttribute('image', 'chrome://https-everywhere/skin/'+image_src);

    // all done
    this.prepend_child(item);
  },

  show_applicable: function() {
    this.log(WARN, "Applicable list number " + this.serial);
    for (var x in this.active) 
      this.log(WARN,"Active: " + this.active[x].name);

    for (var x in this.breaking) 
      this.log(WARN,"Breaking: " + this.breaking[x].name);
  
    for (x in this.inactive) 
      this.log(WARN,"Inactive: " + this.inactive[x].name);

    for (x in this.moot) 
      this.log(WARN,"Moot: " + this.moot[x].name);
    
  }
};

