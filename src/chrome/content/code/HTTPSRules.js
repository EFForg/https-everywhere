function Rule(from, to) {
  this.from = from;
  this.to = to;
  this.from_c = new RegExp(from);
}

function Exclusion(pattern) {
  this.pattern = pattern;
  this.pattern_c = new RegExp(pattern);
}

function CookieRule(host, cookiename) {
  this.host = host
  this.host_c = new RegExp(host);
  this.cookiename = cookiename;
  this.cookiename_c = new RegExp(cookiename);
}

function RuleSet(name, match_rule, default_off) {
  var on_by_default = true;
  this.name = name;
  this.ruleset_match = match_rule;
  if (match_rule) {
    this.ruleset_match_c = new RegExp(match_rule);
  } else {
    this.ruleset_match_c = null;
  }
  if (default_off) {
    // Perhaps problematically, this currently ignores the actual content of
    // the default_off XML attribute.  Ideally we'd like this attribute to be
    // "valueless"
    on_by_default = false;
  }
  this.rules = [];
  this.exclusions = [];
  this.cookierules = [];
  var prefs = HTTPSEverywhere.instance.get_prefs();
  try {
    // if this pref exists, use it
    this.active = prefs.getBoolPref(name);
  } catch (e) {
    // if not, create it
    this.log(DBUG, "Creating new pref " + name);
    this.active = true;
    prefs.setBoolPref(name, on_by_default);
  }
}

RuleSet.prototype = {
  _apply: function(urispec) {
    var i;
    var returl = null;
    if (!this.active) {
      return null;
    }
    // If a rulset has a match_rule and it fails, go no further
    if (this.ruleset_match_c && !this.ruleset_match_c.test(urispec)) {
      this.log(VERB, "ruleset_match_c excluded " + urispec);
      return null;
    }
    // Even so, if we're covered by an exclusion, go home
    for(i = 0; i < this.exclusions.length; ++i) {
      if (this.exclusions[i].pattern_c.test(urispec)) {
        this.log(DBUG,"excluded uri " + urispec);
        return null;
      }
    }
    // Okay, now find the first rule that triggers
    for(i = 0; i < this.rules.length; ++i) {
      returl = urispec.replace(this.rules[i].from_c,
                               this.rules[i].to);
      if (returl != urispec) {
        return returl;
      }
    }
    if (this.ruleset_match_c) {
      // This is not an error, because we do not insist the matchrule
      // precisely describes to target space of URLs ot redirected
      this.log(DBUG,"Ruleset "+this.name
              +" had an applicable match-rule but no matching rules");
    }
    return null;
  },
  log: function(level, msg) {
    https_everywhereLog(level, msg);
  },

  rewrittenURI: function(uri) {
    // If no rule applies, return null; otherwise, return a fresh uri instance
    // for the target
    var newurl = this._apply(uri.spec);
    if (null == newurl)
      return null;
    var newuri = Components.classes["@mozilla.org/network/standard-url;1"].
                createInstance(CI.nsIStandardURL);
    newuri.init(CI.nsIStandardURL.URLTYPE_STANDARD, 80,
             newurl, uri.originCharset, null);
    newuri = newuri.QueryInterface(CI.nsIURI);
    return newuri;
  },

  replaceURI: function(uri) {
    // Strategy 1: replace the parts of the old uri piecewise.  Often this
    // works.  In some cases it doesn't.
    var newuri = this.rewrittenURI(uri);
    if (!newuri) return false;
    this.log(NOTE,"Rewriting " + uri.spec + " -> " + newuri.spec + "\n");
    HTTPSEverywhere.instance.notifyObservers(uri, newuri.spec);

    uri.scheme = newuri.scheme;
    uri.userPass = newuri.userPass;
    uri.username = newuri.username;
    if (newuri.password)
      uri.password = newuri.password;
    uri.host = newuri.host;
    uri.port = newuri.port;
    uri.path = newuri.path;
    return true;
  },

};

const RuleWriter = {
  getCustomRuleDir: function() {
    var loc = "ProfD";  // profile directory
    var file =
      CC["@mozilla.org/file/directory_service;1"]
      .getService(CI.nsIProperties)
      .get(loc, CI.nsILocalFile)
      .clone();
    file.append("HTTPSEverywhereUserRules");
    // Check for existence, if not, create.
    if (!file.exists()) {
      file.create(CI.nsIFile.DIRECTORY_TYPE, 0700);
    }
    if (!file.isDirectory()) {
      // XXX: Arg, death!
    }
    return file;
  },

  getRuleDir: function() {
    var file = CC["@mozilla.org/extensions/manager;1"].
               getService(Components.interfaces.nsIExtensionManager).
               getInstallLocation("https-everywhere@eff.org").
               getItemFile("https-everywhere@eff.org", "chrome").clone();
    file.append("content");
    file.append("rules");
    if (!file.isDirectory()) {
      // XXX: Arg, death!
    }
    return file;
  },

  write: function(ruleset) {
    var rulesAsXml = new XML('<ruleset/>');
    var i = 0;
    if (ruleset.ruleset_match)
      rulesAsXml.@ruleset_match = ruleset.ruleset_match;
    rulesAsXml.@name = ruleset.name;

    for(i = 0; i < ruleset.rules.length; ++i) {
      var rule = new XML('<rule/>');
      rule.@from = ruleset.rules[i].from;
      rule.@to = ruleset.rules[i].to;
      rulesAsXml.appendChild(rule);
    }

    var xmlString = rulesAsXml.toString();

    var dest = this._getCustomRuleDir();
    dest.append(ruleset.name + ".xml");

    var foStream = CC["@mozilla.org/network/file-output-stream;1"]
          .createInstance(CI.nsIFileOutputStream);
    foStream.init(dest, 0x02 | 0x08 | 0x20, 0600, 0);

    foStream.write(xmlString, xmlString.length);
    foStream.close();
  },

  read: function(file) {
    if (!file.exists())
      return null;
    var data = "";
    var fstream = CC["@mozilla.org/network/file-input-stream;1"]
        .createInstance(CI.nsIFileInputStream);
    var sstream = CC["@mozilla.org/scriptableinputstream;1"]
        .createInstance(CI.nsIScriptableInputStream);
    fstream.init(file, -1, 0, 0);
    sstream.init(fstream);

    var str = sstream.read(4096);
    while (str.length > 0) {
      data += str;
      str = sstream.read(4096);
    }

    sstream.close();
    fstream.close();
    try {
      var xmlrules = XML(data);
    } catch(e) { // file has been corrupted; XXX: handle error differently
      this.log(WARN,"Error in XML file: " + file + "\n" + e);
      return null;
    }

    if (xmlrules.@name == xmlrules.@nonexistantthing) {
      this.log(DBUG, "FILE " + file + "is not a rulefile\n");
      return null;
    }

    var match_rl = null;
    var dflt_off = null;
    if (xmlrules.@match_rule.length() > 0) match_rl = xmlrules.@match_rule;
    if (xmlrules.@default_off.length() > 0) dflt_off = xmlrules.@default_off;
    var ret = new RuleSet(xmlrules.@name, match_rl, dflt_off);

    for (var i = 0; i < xmlrules.exclusion.length(); i++) {
      var exclusion = new Exclusion(xmlrules.exclusion[i].@pattern);
      ret.exclusions.push(exclusion);
    }

    for (var i = 0; i < xmlrules.rule.length(); i++) {
      var rule = new Rule(xmlrules.rule[i].@from,
                          xmlrules.rule[i].@to);

      ret.rules.push(rule);
    }

    for (var i = 0; i < xmlrules.securecookie.length(); i++) {
      var c_rule = new CookieRule(xmlrules.securecookie[i].@host,
                                  xmlrules.securecookie[i].@name);
      ret.cookierules.push(c_rule);
      this.log(DBUG,"Cookie rule "+ c_rule.host+ " " +c_rule.cookiename);
    }

    return ret;
  },

  enumerate: function(dir) {
    // file is the given directory (nsIFile)
    var entries = dir.directoryEntries;
    var ret = [];
    while(entries.hasMoreElements()) {
      var entry = entries.getNext();
      entry.QueryInterface(Components.interfaces.nsIFile);
      ret.push(entry);
    }
    return ret;
  },
};



const HTTPSRules = {
  init: function() {
    try {
      this.rules = [];
      this.exclusions = [];
      var rulefiles = RuleWriter.enumerate(RuleWriter.getCustomRuleDir());
      this.scanRulefiles(rulefiles);
      rulefiles = RuleWriter.enumerate(RuleWriter.getRuleDir());
      this.scanRulefiles(rulefiles);

    } catch(e) {
      this.log(WARN,"Rules Failed: "+e);
    }
    this.log(DBUG,"Rules loaded");
    return;
  },

  scanRulefiles: function(rulefiles) {
    var i = 0;
    var r = null;
    for(i = 0; i < rulefiles.length; ++i) {
      try {
        this.log(DBUG,"Loading rule file: "+rulefiles[i].path);
        r = RuleWriter.read(rulefiles[i]);
        if (r != null)
          this.rules.push(r);
      } catch(e) {
        this.log(WARN, "Error in rules file: " + e);
      }
    }
  },

  replaceURI: function(uri) {
    var i = 0;
    for(i = 0; i < this.rules.length; ++i) {
      if(this.rules[i].replaceURI(uri))
        return true;
    }
    return false;
  },

  rewrittenURI: function(uri) {
    var i = 0;
    var newuri = null
    for(i = 0; i < this.rules.length; ++i) {
      if ((newuri = this.rules[i].rewrittenURI(uri)))
        return newuri;
    }
    return null;
  },
  
  should_secure_cookie: function(cookie) {
    var i = 0;
    for (i = 0; i < this.cookierules.length; ++i) {
      this.log(DBUG, "Testing cookie:");
      this.log(DBUG, "  name: " + c.name);
      this.log(DBUG, "  host: " + c.host);
      this.log(DBUG, "  domain: " + c.domain);
      this.log(DBUG, "  rawhost: " + c.rawHost);
      var cr = this.cookierules[i];
      if (cr.host_c.test(c.host) && cr.name_c.test(c.name)) {
        return true;
      } else {
        return false;
      }
    }
  }

};
