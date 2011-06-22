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
  this.log(DBUG,"Alist serial #" + this.serial + " for " + this.home);
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

  populate_menu: function(document, alert) {
    this.log(DBUG, "populating using alist #" + this.serial);
    
    // get the menu popup
    var menupopup = document.getElementById('https-everywhere-context');

    // empty it all of its menuitems
    while(menupopup.firstChild) {
      menupopup.removeChild(menupopup.firstChild);
    }

    // create a commandset if it doesn't already exist
    var commandset = document.getElementById('https-everywhere-commandset');
    if(!commandset) {
      commandset = document.createElement('commandset');
      commandset.setAttribute('id', 'https-everywhere-commandset');
      var button = document.getElementById('https-everywhere-button');
      button.appendChild(commandset);
    } else {
      // empty commandset
      while(commandset.firstChild) {
        commandset.removeChild(commandset.firstChild);
      }
    }

    // add all applicable commands
    function add_command(rule) {
      var command = document.createElement("command");
      command.setAttribute('id', rule.id+'-command');
      command.setAttribute('label', rule.name);
      command.setAttribute('oncommand', 'toggle_rule("'+rule.id+'")');
      commandset.appendChild(command);
    }
    for(var x in this.active) { 
      add_command(this.active[x]); 
    }
    for(var x in this.moot) {
      add_command(this.moot[x]);
    }
    for(var x in this.inactive) { 
      add_command(this.inactive[x]);
    }


    // add a menu item for a rule -- type is "active", "inactive", or "moot"
    function add_menuitem(rule, type) {
      // create the menuitem
      var item = document.createElement('menuitem');
      item.setAttribute('command', rule.id+'-command');
      item.setAttribute('class', type+'-item');

      // set the icon
      var image = document.createElement('image');
      var image_src;
      if(type == 'active') image_src = 'tick.png';
      else if(type == 'inactive') image_src = 'cross.png';
      else if(type == 'moot') image_src = 'tick-moot.png';
      image.setAttribute('src', 'chrome://https-everywhere/skin/'+image_src);

      // set the label
      var label = document.createElement('label');
      label.setAttribute('value', rule.name);
      
      // put them in an hbox, and put the hbox in the menuitem
      var hbox = document.createElement('hbox');
      hbox.appendChild(image);
      hbox.appendChild(label);
      item.appendChild(hbox);

      // all done
      menupopup.appendChild(item);
    }

    // add all the menu items
    for(var x in this.active) {
      add_menuitem(this.active[x], 'active');
    }
    for(var x in this.moot) {
      if(!(x in this.active) ) {
        // rules that are active for some uris are not really moot
        add_menuitem(this.moot[x], 'moot');
      } else {
        this.log(WARN,"Moot rule invisible " + this.moot[x].name);
      }
    }
    for(var x in this.inactive) {
      add_menuitem(this.inactive[x], 'inactive');
    }

    // add other menu items
    menupopup.appendChild(document.createElement('menuseparator'));

    // preferences, about
    var preferences = document.createElement('menuitem');
    preferences.setAttribute('label', 'Preferences');
    menupopup.appendChild(preferences);
    var about = document.createElement('menuitem');
    about.setAttribute('label', 'About HTTPS Everywhere');
    menupopup.appendChild(about);

    // separator
    menupopup.appendChild(document.createElement('menuseparator'));

    // donate
    var donate_eff = document.createElement('menuitem');
    donate_eff.setAttribute('label', 'Donate to Electronic Frontier Foundation');
    menupopup.appendChild(donate_eff);
    var donate_tor = document.createElement('menuitem');
    donate_tor.setAttribute('label', 'Donate to Tor Project');
    menupopup.appendChild(donate_tor);

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

