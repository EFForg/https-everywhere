function Rule(from, to) {
  this.from = from;
  this.to = to;
  this.from_c = new RegExp(from);
}

function Exclusion(pattern) {
  this.pattern = pattern;
  this.pattern_c = new RegExp(pattern);
}

function RuleSet(name, match_rule) {
  this.name = name;
  this.ruleset_match = match_rule;
  if (match_rule) {
    this.ruleset_match_c = new RegExp(match_rule);
  } else {
    this.ruleset_match_c = null;
  }
  this.rules = [];
  this.exclusions = [];
  var prefs = HTTPSInstance.get_prefs();
  try {
    // if this pref exists, use it
    this.active = prefs.getBoolPref(name);
  } catch (e) {
    // if not, create it
    this.log(DBUG, "Creating new pref " + name);
    this.active = true;
    prefs.setBoolPref(name, true);
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
    var loc = "ProfD";  // profile directory
    var file =
      CC["@mozilla.org/file/directory_service;1"]
      .getService(CI.nsIProperties)
      .get(loc, CI.nsILocalFile)
      .clone();
    file.append("extensions");
    file.append("https-everywhere@eff.org");
    file.append("chrome");
    file.append("content");
    file.append("rules");
    // Check for existence, if not, create.
    if (!file.exists()) {
      file.create(CI.nsIFile.DIRECTORY_TYPE, 0700);
    }
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

    if (xmlrules.@match_rule.length() > 0) {
      var ret = new RuleSet(xmlrules.@name, xmlrules.@match_rule);
    } else {
      var ret = new RuleSet(xmlrules.@name, null);
    }

    for (var i = 0; i < xmlrules.exclusion.length(); i++) {
      var exclusion = new Exclusion(xmlrules.exclusion[i].@pattern);
      ret.exclusions.push(exclusion);
    }

    for (var i = 0; i < xmlrules.rule.length(); i++) {
      var rule = new Rule(xmlrules.rule[i].@from,
                          xmlrules.rule[i].@to);

      ret.rules.push(rule);
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
    /*
    // XXX: Major, temporary hack.
    var ruleset = new RuleSet("Facebook", null);
    ruleset.rules.push(new Rule("^http://www.facebook.com",
                                "https://www.facebook.com"));
    RuleWriter.write(ruleset);
    this.rules = [];
    this.rules.push(ruleset);
    return;
    */
    try {
      var rulefiles = RuleWriter.enumerate(RuleWriter.getCustomRuleDir());
      var i = 0;
      this.rules = [];
      this.exclusions = [];
      for(i = 0; i < rulefiles.length; ++i) {
        try {
          this.log(DBUG,"Loading rule file: "+rulefiles[i]);
          this.rules.push(RuleWriter.read(rulefiles[i]));
        } catch(e) {
          this.log(WARN, "Error in rules file: " + e);
        }
      }

      var rulefiles = RuleWriter.enumerate(RuleWriter.getRuleDir());
      var i = 0;
      for(i = 0; i < rulefiles.length; ++i) {
        try {
          this.log(DBUG,"Loading rule file: "+rulefiles[i]);
          this.rules.push(RuleWriter.read(rulefiles[i]));
        } catch(e) {
          this.log(WARN, "Error in rules file: " + e);
        }
      }
    } catch(e) {
      this.log(WARN,"Rules Failed: "+e);
    }
    this.log(DBUG,"Rules loaded");
    return;
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
      if((newuri = this.rules[i].rewrittenURI(uri)))
        return newuri;
    }
    return null;
  }


};
