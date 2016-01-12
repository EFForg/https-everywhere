// Compilation of RegExps is now delayed until they are first used...

function Rule(from, to) {
  this.to = to;
  this.from_c = from; // This will become a RegExp after compilation
}

function Exclusion(pattern) {
  this.pattern_c = pattern; // Will become a RegExp after compilation
}

function CookieRule(host, cookiename) {
  this.host = host;
  this.name = cookiename;

  // These will be made during compilation:

  //this.host_c = new RegExp(host);
  //this.name_c = new RegExp(cookiename);
}

function RuleSet(id, name, xmlName, match_rule, default_off, platform) {
  if(xmlName == "WordPress.xml" || xmlName == "Github.xml") {
    this.log(NOTE, "RuleSet( name="+name+", xmlName="+xmlName+", match_rule="+match_rule+", default_off="+default_off+", platform="+platform+" )");
  }

  this.id=id;
  this.on_by_default = true;
  this.compiled = false;
  this.name = name;
  this.xmlName = xmlName;
  this.notes = "";

  if (match_rule)   this.ruleset_match_c = new RegExp(match_rule);
  else              this.ruleset_match_c = null;
  if (default_off) {
    // Perhaps problematically, this currently ignores the actual content of
    // the default_off XML attribute.  Ideally we'd like this attribute to be
    // "valueless"
    this.notes = default_off;
    this.on_by_default = false;
  }
  if (platform)
    if (platform.search(HTTPSRules.localPlatformRegexp) == -1) {
      this.on_by_default = false;
      this.notes = "Only for " + platform;
    }

  this.rules = [];
  this.exclusions = [];
  this.cookierules = [];

  this.rule_toggle_prefs = HTTPSEverywhere.instance.rule_toggle_prefs;

  try {
    // if this pref exists, use it
    this.active = this.rule_toggle_prefs.getBoolPref(name);
  } catch(e) {
    // if not, use the default
    this.active = this.on_by_default;
  }
}

var dom_parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);

RuleSet.prototype = {

  ensureCompiled: function() {
    // Postpone compilation of exclusions, rules and cookies until now, to accelerate
    // browser load time.
    // NOTE: Since rulesets are now lazy-loaded in FF, this will be called immediately
    // after the ruleset is loaded, and doesn't give much startup benefit. We
    // may want to switch these back so patterns are compiled immediately on
    // ruleset load, for simplicity.
    if (this.compiled) return;
    var i;

    for (i = 0; i < this.exclusions.length; ++i) {
      this.exclusions[i].pattern_c = new RegExp(this.exclusions[i].pattern_c);
    }
    for (i = 0; i < this.rules.length; ++i) {
      this.rules[i].from_c = new RegExp(this.rules[i].from_c);
    }

    for (i = 0; i < this.cookierules.length; i++) {
       var cr = this.cookierules[i];
       cr.host_c = new RegExp(cr.host);
       cr.name_c = new RegExp(cr.name);
    }

    this.compiled = true;
  },

  apply: function(urispec) {
    // return null if it does not apply
    // and the new url if it does apply
    var i;
    var returl = null;
    this.ensureCompiled();
    // If a rulset has a match_rule and it fails, go no further
    if (this.ruleset_match_c && !this.ruleset_match_c.test(urispec)) {
      this.log(VERB, "ruleset_match_c excluded " + urispec);
      return null;
    }
    // Even so, if we're covered by an exclusion, go home
    for (i = 0; i < this.exclusions.length; ++i) {
      if (this.exclusions[i].pattern_c.test(urispec)) {
        this.log(DBUG,"excluded uri " + urispec);
        return null;
      }
    }
    // Okay, now find the first rule that triggers
    for (i = 0; i < this.rules.length; ++i) {
      // This is just for displaying inactive rules
      returl = urispec.replace(this.rules[i].from_c, this.rules[i].to);
      if (returl != urispec) {
        // we rewrote the uri
        this.log(DBUG, "Rewrote " + urispec + " -> " + returl + " using " + this.xmlName + ": " + this.rules[i].from_c + " -> " + this.rules[i].to);
        return returl;
      }
    }

    return null;
  },
  log: function(level, msg) {
    https_everywhereLog(level, msg);
  },
 
  wouldMatch: function(hypothetical_uri, alist) {
    // return true if this ruleset would match the uri, assuming it were http
    // used for judging moot / inactive rulesets
    // alist is optional
 
    // if the ruleset is already somewhere in this applicable list, we don't
    // care about hypothetical wouldMatch questions
    if (alist && (this.name in alist.all)) return false;
 
    this.log(DBUG,"Would " +this.name + " match " +hypothetical_uri.spec +
             "?  serial " + (alist && alist.serial));
     
    var uri = hypothetical_uri.clone();
    if (uri.scheme == "https") uri.scheme = "http";
    var urispec = uri.spec;

    this.ensureCompiled();
 
    if (this.ruleset_match_c && !this.ruleset_match_c.test(urispec)) 
      return false;
 
    for (var i = 0; i < this.exclusions.length; ++i) 
      if (this.exclusions[i].pattern_c.test(urispec)) return false;
 
    for (var i = 0; i < this.rules.length; ++i) 
      if (this.rules[i].from_c.test(urispec)) return true;
    return false;
  },

  transformURI: function(uri) {
    // If no rule applies, return null; if a rule would have applied but was
    // inactive, return 0; otherwise, return a fresh uri instance
    // for the target
    var newurl = this.apply(uri.spec);
    if (null == newurl) 
      return null;
    var newuri = Components.classes["@mozilla.org/network/standard-url;1"].
                 createInstance(CI.nsIStandardURL);
    newuri.init(CI.nsIStandardURL.URLTYPE_STANDARD, 80,
             newurl, uri.originCharset, null);
    newuri = newuri.QueryInterface(CI.nsIURI);
    return newuri;
  },

  enable: function() {
    // Enable us.
    this.rule_toggle_prefs.setBoolPref(this.name, true);
    this.active = true;
  },

  disable: function() {
    // Disable us.
    this.rule_toggle_prefs.setBoolPref(this.name, false);
    this.active = false;
  },

  toggle: function() {
    this.active = !this.active;
    this.rule_toggle_prefs.setBoolPref(this.name, this.active);
  },

  clear: function() {
    try {
      this.rule_toggle_prefs.clearUserPref(this.name);
    } catch(e) {
      // this ruleset has never been toggled
    }
    this.active = this.on_by_default;
  }
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

  chromeToPath: function (aPath) {
    if (!aPath || !(/^chrome:/.test(aPath)))
       return; //not a chrome url

    var ios =
      CC['@mozilla.org/network/io-service;1']
      .getService(CI.nsIIOService);
    var uri = ios.newURI(aPath, "UTF-8", null);
    var cr =
      CC['@mozilla.org/chrome/chrome-registry;1']
      .getService(CI.nsIChromeRegistry);
    var rv = cr.convertChromeURL(uri).spec;

    if (/^file:/.test(rv))
      rv = this.urlToPath(rv);
    else
      rv = this.urlToPath("file://"+rv);

    return rv;
  },

  urlToPath: function (aPath) {
    if (!aPath || !/^file:/.test(aPath))
      return ;

    var ph =
      CC["@mozilla.org/network/protocol;1?name=file"]
      .createInstance(CI.nsIFileProtocolHandler);
    var rv = ph.getFileFromURLSpec(aPath).path;

    return rv;
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
    return data;
  },

  write: function(file, data) {
    //if (!file.exists())
    //  return null;
    this.log(DBUG, "Opening " + file.path + " for writing");
    var fstream = CC["@mozilla.org/network/file-output-stream;1"]
        .createInstance(CI.nsIFileOutputStream);
    fstream.init(file, -1, -1, 0);

    var retval = fstream.write(data, data.length);
    this.log(DBUG, "Got retval " + retval);
    fstream.close();
    return data;
  },

  rulesetFromFile: function(file, rule_store, ruleset_id) {
    if ((rule_store.targets == null) && (rule_store.targets != {}))
      this.log(WARN, "TARGETS IS NULL");
    var data = this.read(file);
    if (!data) return null;
    return this.readFromString(data, rule_store, ruleset_id);
  },

  readFromString: function(data, rule_store, ruleset_id) {
    try {
      var xmlruleset = dom_parser.parseFromString(data, "text/xml");
    } catch(e) { // file has been corrupted; XXX: handle error differently
      this.log(WARN,"Error in XML data: " + e + "\n" + data);
      return null;
    }
    this.parseOneRuleset(xmlruleset.documentElement, rule_store, ruleset_id);
  },

  parseOneRuleset: function(xmlruleset, rule_store, ruleset_id) {
    // Extract an xmlruleset into the rulestore
    if (!xmlruleset.getAttribute("name")) {
      this.log(WARN, "This blob: '" + xmlruleset + "' is not a ruleset\n");
      return null;
    }

    this.log(DBUG, "Parsing " + xmlruleset.getAttribute("name"));

    var match_rl = xmlruleset.getAttribute("match_rule");
    var dflt_off = xmlruleset.getAttribute("default_off");
    var platform = xmlruleset.getAttribute("platform");
    var rs = new RuleSet(ruleset_id, xmlruleset.getAttribute("name"), xmlruleset.getAttribute("f"), match_rl, dflt_off, platform);

    // see if this ruleset has the same name as an existing ruleset;
    // if so, this ruleset is ignored; DON'T add or return it.
    if (rs.name in rule_store.rulesetsByName) {
      this.log(WARN, "Error: found duplicate rule name " + rs.name);
      return null;
    }

    // Add this ruleset id into HTTPSRules.targets if it's not already there.
    // This should only happen for custom user rules. Built-in rules get
    // their ids preloaded into the targets map, and have their <target>
    // tags stripped when the sqlite database is built.
    var targets = xmlruleset.getElementsByTagName("target");
    for (var i = 0; i < targets.length; i++) {
      var host = targets[i].getAttribute("host");
      if (!host) {
        this.log(WARN, "<target> missing host in " + xmlruleset.getAttribute("name"));
        return null;
      }
      if (! rule_store.targets[host])
        rule_store.targets[host] = [];
      this.log(DBUG, "Adding " + host + " to targets, pointing at " + ruleset_id);
      rule_store.targets[host].push(ruleset_id);
    }

    var exclusions = xmlruleset.getElementsByTagName("exclusion");
    for (var i = 0; i < exclusions.length; i++) {
      var exclusion = new Exclusion(exclusions[i].getAttribute("pattern"));
      rs.exclusions.push(exclusion);
    }

    var rules = xmlruleset.getElementsByTagName("rule");
    for (var i = 0; i < rules.length; i++) {
      var rule = new Rule(rules[i].getAttribute("from"),
                          rules[i].getAttribute("to"));
      rs.rules.push(rule);
    }

    var securecookies = xmlruleset.getElementsByTagName("securecookie");
    for (var i = 0; i < securecookies.length; i++) {
      var c_rule = new CookieRule(securecookies[i].getAttribute("host"),
                                  securecookies[i].getAttribute("name"));
      rs.cookierules.push(c_rule);
      this.log(DBUG,"Cookie rule "+ c_rule.host+ " " +c_rule.name);
    }

    rule_store.rulesets.push(rs);
    rule_store.rulesetsByID[rs.id] = rs;
    rule_store.rulesetsByName[rs.name] = rs;
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
      this.rulesets = [];
      this.targets = {};  // dict mapping target host pattern -> list of
                          // applicable ruleset ids
      this.rulesetsByID = {};
      this.rulesetsByName = {};
      this.targetsLoaded = false;
      this.targetsLoadingCallbacks = [];
      this.checkMixedContentHandling();
      var rulefiles = RuleWriter.enumerate(RuleWriter.getCustomRuleDir());
      this.scanRulefiles(rulefiles);

      // Initialize database connection.
      var dbFile = new FileUtils.File(RuleWriter.chromeToPath("chrome://https-everywhere/content/rulesets.sqlite"));
      this.rulesetDBConn = Services.storage.openDatabase(dbFile);
    } catch(e) {
      this.log(DBUG,"Rules Failed: "+e);
    }

    return;
  },

  loadTargets: function(callback) {
    if (this.targetsLoaded) {
      callback();
      return;
    }
    // loadTargets can be called multiple times before it resolves. We store a
    // list of callbacks to call when done, and make sure we only actually do
    // the query once.
    this.targetsLoadingCallbacks.push(callback);
    if (this.targetsLoadingCallbacks.length > 1) {
      this.log(DBUG, "Skipping loadTargets, a query is already in progress.");
    }
    // Load the mapping of hostname target -> ruleset ID from DB.
    // This is a little slow (287 ms on a Core2 Duo @ 2.2GHz with SSD),
    // but is faster than loading all of the rulesets. If this becomes a
    // bottleneck, change it to load in a background webworker, or load
    // a smaller bloom filter instead.
    var t1 = new Date().getTime();
    var query = this.rulesetDBConn.createStatement("select host, ruleset_id from targets");
    var that = this;
    var count = 0;
    this.log(INFO, "Querying targets");
    // TODO: Store "this is pending" and resolve all pending once the whole
    // thing is loaded.
    query.executeAsync({
      handleResult: function(aResultSet) {
        try {
        for (let row = aResultSet.getNextRow();
             row;
             row = aResultSet.getNextRow()) {
          var host = row.getResultByName("host");
          var id = row.getResultByName("ruleset_id");
          count ++;
          if (!that.targets[host]) {
            that.targets[host] = [id];
          } else {
            that.targets[host].push(id);
          }
        }
        } catch (e) {
          that.log(WARN, "ERROR " + e);
        }
      },
      handleError: function(aError) {
        that.log(WARN, "SQLite error loading targets: " + aError.message);
        callback();
      },

      handleCompletion: function(aReason) {
        if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
          that.log(WARN, "SQLite query canceled or aborted!");
        } else {
          var t2 =  new Date().getTime();
          that.log(NOTE, "Loading " + count + " targets took " + (t2 - t1) / 1000.0 + " seconds");
          that.targetsLoadingCallbacks.forEach(function(callback) {
            callback();
          });
          that.targetsLoadingCallbacks = [];
          that.targetsLoaded = true;
        }
      }
    });
  },

  checkMixedContentHandling: function() {
    // Firefox 23+ blocks mixed content by default, so rulesets that create
    // mixed content situations should be disabled there
    var appInfo = CC["@mozilla.org/xre/app-info;1"].getService(CI.nsIXULAppInfo);
    var platformVer = appInfo.platformVersion;
    var versionChecker = CC["@mozilla.org/xpcom/version-comparator;1"]
                          .getService(CI.nsIVersionComparator);
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefService).getBranch("");


    // If mixed content is present and enabled, and the user hasn't opted to enable
    // mixed content triggering rules, leave them out. Otherwise add them in.
    if(versionChecker.compare(appInfo.version, "23.0a1") >= 0
            && prefs.getBoolPref("security.mixed_content.block_active_content")
            && !prefs.getBoolPref("extensions.https_everywhere.enable_mixed_rulesets")) {
      this.log(INFO, "Not activating rules that trigger mixed content errors.");
      this.localPlatformRegexp = new RegExp("firefox");
    } else {
      this.log(INFO, "Activating rules that would normally trigger mixed content");
      this.localPlatformRegexp = new RegExp("(firefox|mixedcontent)");
    }
  },

  scanRulefiles: function(rulefiles) {
    var i = 0;
    var r = null;
    for(i = 0; i < rulefiles.length; ++i) {
      try {
        this.log(DBUG,"Loading ruleset file: "+rulefiles[i].path);
        var ruleset_id = "custom_" + i;
        RuleWriter.rulesetFromFile(rulefiles[i], this, ruleset_id);
      } catch(e) {
        this.log(WARN, "Error in ruleset file: " + e);
        if (e.lineNumber)
          this.log(WARN, "(line number: " + e.lineNumber + ")");
      }
    }
  },

  resetRulesetsToDefaults: function() {
    // Callable from within the prefs UI and also for cleaning up buggy
    // configurations...
    for (var i in this.rulesets) {
      this.rulesets[i].clear();
    }
  },

  // return true iff callback has been called already, false if callback will be
  // called asynchronously
  rewrittenURI: function(alist, input_uri, callback) {
    // This function oversees the task of working out if a uri should be
    // rewritten, what it should be rewritten to, and recordkeeping of which
    // applicable rulesets are and aren't active.  Previously this returned
    // the new uri if there was a rewrite.  Now it returns a JS object with a
    // newuri attribute and an applied_ruleset attribute (or null if there's
    // no rewrite).
    var i = 0; 
    userpass_present = false; // Global so that sanitiseURI can tweak it.
                              // Why does JS have no tuples, again?
    var blob = {}; blob.newuri = null;
    if (!alist) this.log(DBUG, "No applicable list rewriting " + input_uri.spec);
    this.log(DBUG, "Processing " + input_uri.spec);

    // Get the list of rulesets that target this host
    try {
      var host = input_uri.host
    } catch(e) {
      // NS_ERROR_FAILURE is normal for accessing uri.host. It just means that
      // host is not applicable for the URI scheme, e.g. about: URIs.
      // If that happens we quietly return null. If another exception happens
      // we noisily return null.
      if (e.name != "NS_ERROR_FAILURE") {
        this.log(WARN, 'Could not get host from ' + input_uri.spec + ': ' + e);
      }
      callback(null);
      return true;
    }
    var that = this;
    return this.potentiallyApplicableRulesets(host, function(rs) {
      var uri = that.sanitiseURI(input_uri);
      // ponder each potentially applicable ruleset, working out if it applies
      // and recording it as active/inactive/moot/breaking in the applicable list
      for (i = 0; i < rs.length; ++i) {
        if (!rs[i].active) {
          if (alist && rs[i].wouldMatch(uri, alist))
            alist.inactive_rule(rs[i]);
          continue;
        }
        blob.newuri = rs[i].transformURI(uri);
        if (blob.newuri) {
          if (alist) {
            if (uri.spec in https_everywhere_blacklist) {
              alist.breaking_rule(rs[i]);
            } else {
              alist.active_rule(rs[i]);
            }
          }
          if (userpass_present) blob.newuri.userPass = input_uri.userPass;
          blob.applied_ruleset = rs[i];
          callback(blob);
          return
        }
        if (uri.scheme == "https" && alist) {
          // we didn't rewrite but the rule applies to this domain and the
          // requests are going over https
          if (rs[i].wouldMatch(uri, alist)) alist.moot_rule(rs[i]);
          continue;
        }
      }
      callback(null);
      return;
    });
  },

  sanitiseURI: function(input_uri) {
    // Rulesets shouldn't try to parse usernames and passwords.  If we find
    // those, apply the ruleset without them (and then add them back later).
    // When .userPass is absent, sometimes it is false and sometimes trying
    // to read it raises an exception (probably depending on the URI type).
    var uri = input_uri;
    try {
      if (input_uri.userPass) {
        uri = input_uri.clone();
        userpass_present = true; // tweaking a global in our caller :(
        uri.userPass = null;
      } 
    } catch(e) {}

    // example.com.  is equivalent to example.com
    // example.com.. is invalid, but firefox would load it anyway
    try {
      if (uri.host)
        try {
          var h = uri.host;
          if (h.charAt(h.length - 1) == ".") {
            while (h.charAt(h.length - 1) == ".") 
              h = h.slice(0,-1);
            uri = uri.clone();
            uri.host = h;
          }
        } catch(e) {
          this.log(WARN, "Failed to normalise domain: ");
          try       {this.log(WARN, input_uri.host);}
          catch(e2) {this.log(WARN, "bang" + e + " & " + e2 + " & "+ input_uri);}
        }
    } catch(e3) {
      this.log(INFO, "uri.host is explosive!");
      try       { this.log(INFO, "(" + uri.spec + ")"); }  // happens for about: uris and so forth
      catch(e4) { this.log(WARN, "(and unprintable!!!!!!)"); }
    }
    return uri;
  },

  setInsert: function(intoList, fromList) {
    // Insert any elements from fromList into intoList, if they are not
    // already there.  fromList may be null.
    if (!fromList) return;
    for (var i = 0; i < fromList.length; i++)
      if (intoList.indexOf(fromList[i]) == -1)
        intoList.push(fromList[i]);
  },

  // Load a ruleset by numeric id, e.g. 234
  loadRulesetById: function(ruleset_id, callback) {
    var query = this.rulesetDBConn.createStatement(
      "select contents from rulesets where id = :id");
    query.params.id = ruleset_id;
    var that = this;
    query.executeAsync({
      handleResult: function(aResultSet) {
        for (let row = aResultSet.getNextRow();
             row;
             row = aResultSet.getNextRow()) {

          let value = row.getResultByName("contents");
          RuleWriter.readFromString(value, that, ruleset_id);
        }
      },
      handleError: function(aError) {
        that.log(WARN, "SQLite error: " + aError.message);
        callback();
      },

      handleCompletion: function(aReason) {
        if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
          that.log(WARN, "SQLite query canceled or aborted!");
        }
        callback();
      }
    });
  },

  // Get all rulesets matching a given target, lazy-loading from DB as necessary.
  // Returns true if callback was called immediately: i.e., didn't have to go async.
  rulesetsByTargets: function(targets, callback) {
    // If the array of target hosts is not already loaded, load it
    // (asynchronously). This should only happen once.
    if (!this.targetsLoaded) {
      this.log(INFO, "Loading targets");
      this.loadTargets(this.rulesetsByTargets.bind(this, targets, callback));
      return false;
    } else {
      this.log(INFO, "Targets are loaded " + this.targets["www.eff.org"]);
    }
    var foundIds = [];
    var neededIds = [];
    var that = this;
    targets.forEach(function(target) {
      var rulesetIds = that.targets[target] || [];
      rulesetIds.forEach(function(id) {
        foundIds.push(id);
        if (!that.rulesetsByID[id]) {
          neededIds.push(id);
        }
      });
    });

    this.log(DBUG, "For targets " + targets.join(' ') +
      ", found ids " + foundIds + ", need to load: " + neededIds);

    var callbackImmediate = true;
    function loadOne(done) {
      if (neededIds.length !== 0) {
        callbackImmediate = false;
        that.loadRulesetById(neededIds.pop(), loadOne.bind(null, done));
      } else {
        done();
      }
    }

    loadOne(function() {
      output = foundIds.map(function(id) {
        return that.rulesetsByID[id];
      })
      that.log(DBUG, "Callback from rulesetsByTargets output = " + output);
      callback(output);
    });
    that.log(DBUG, "Returning from rulesetsByTargets callbackImmediate = " + callbackImmediate);
    return callbackImmediate;
  },

  /**
   * Return a list of rulesets that declare targets matching a given hostname.
   * The returned rulesets include those that are disabled for various reasons.
   * This function is only defined for fully-qualified hostnames. Wildcards and
   * cookie-style domain attributes with a leading dot are not permitted.
   * @param host {string}
   * @return true iff we didn't have to go async to load rules
   */
  potentiallyApplicableRulesets: function(host, callback) {
    if (!callback) {
      this.log(WARN, 'Bad problem: potentiallyApplicableRulesets called without callback.');
      return false;
    }
    var i, tmp, t;
    var targetsToTry = [host];

    // replace each portion of the domain with a * in turn
    var segmented = host.split(".");
    for (i = 0; i < segmented.length; ++i) {
      tmp = segmented[i];
      if (tmp.length === 0) {
        this.log(WARN,"Malformed host passed to potentiallyApplicableRulesets: " + host);
        return false;
      }
      segmented[i] = "*";
      t = segmented.join(".");
      segmented[i] = tmp;
      targetsToTry.push(t);
    }
    // now eat away from the left, with *, so that for x.y.z.google.com we
    // check *.z.google.com and *.google.com (we did *.y.z.google.com above)
    for (i = 2; i <= segmented.length - 2; ++i) {
      t = "*." + segmented.slice(i,segmented.length).join(".");
      targetsToTry.push(t)
    }
    var that = this;
    return this.rulesetsByTargets(targetsToTry, function(rulesets) {
      that.log(DBUG,"Potentially applicable rules for " + host + ":");
      for (i = 0; i < rulesets.length; ++i)
        that.log(DBUG, "  " + rulesets[i].name);
      callback(rulesets);
    });
  },

  /**
   * If a cookie's domain attribute has a leading dot to indicate it should be
   * sent for all subdomains (".example.com"), return the actual host part (the
   * part after the dot).
   *
   * @param cookieDomain {string} A cookie domain to strip a leading dot from.
   * @return {string} a fully qualified hostname.
   */
  hostFromCookieDomain: function(cookieDomain) {
    if (cookieDomain.length > 0 && cookieDomain[0] == ".") {
      return cookieDomain.slice(1);
    } else {
      return cookieDomain;
    }
  },

  /**
   * Check to see if the Cookie object c meets any of our cookierule criteria
   * for being marked as secure.
   *
   * @param applicable_list {ApplicableList} an ApplicableList for record keeping
   * @param c {nsICookie2} The cookie we might secure.
   * @param known_https {boolean} True if the cookie appeared in an HTTPS request and
   *   so we know it is okay to mark it secure (assuming a cookierule matches it.
   *   TODO(jsha): Double-check that the code calling this actually does that.
   * @return {boolean} True if the cookie in question should have the 'secure'
   *   flag set to true.
   */
  shouldSecureCookie: function(applicable_list, c, known_https) {
    this.log(DBUG,"  rawhost: " + c.rawHost + " name: " + c.name + " host" + c.host);
    var i,j;
    // potentiallyApplicableRulesets is defined on hostnames not cookie-style
    // "domain" attributes, so we strip a leading dot before calling.
    var host = this.hostFromCookieDomain(c.host);

    // When checking for potentially applicable rulesets, we have to wait for a
    // callback, because we may need to load the rulesets from disk. However, in
    // practice this callback will always be run immediately, because the
    // ruleset for the necessary host will have been loaded already for the HTTP
    // request.
    var result;
    var callbackedImmediate = this.potentiallyApplicableRulesets(host, function(rs) {
      result = this.shouldSecureCookieWithRulesets(applicable_list, c, known_https, rs);
    }.bind(this));
    if (callbackedImmediate) {
      return result;
    } else {
      this.log(WARN, "Shouldn't happen: rulesets were not already loaded for host " + host)
      // Default to securing cookies if we aren't sure.
      return true
    }
  },

  shouldSecureCookieWithRulesets: function(applicable_list, c, known_https, rs) {
    for (i = 0; i < rs.length; ++i) {
      var ruleset = rs[i];
      if (ruleset.active) {
        ruleset.ensureCompiled();
        // Never secure a cookie if this page might be HTTP
        if (!(known_https || this.safeToSecureCookie(c.rawHost, rs))) {
          continue;
        }
        for (j = 0; j < ruleset.cookierules.length; j++) {
          var cr = ruleset.cookierules[j];
          if (cr.host_c.test(c.host) && cr.name_c.test(c.name)) {
            if (applicable_list) applicable_list.active_rule(ruleset);
            this.log(INFO,"Active cookie rule " + ruleset.name);
            return true;
          }
        }
        if (ruleset.cookierules.length > 0 && applicable_list) {
          applicable_list.moot_rule(ruleset);
        }
      } else if (ruleset.cookierules.length > 0) {
        if (applicable_list) {
          applicable_list.inactive_rule(ruleset);
        }
        this.log(INFO,"Inactive cookie rule " + ruleset.name);
      }
    }
    return false;
  },

  /**
   * Check if the domain might be being served over HTTP.  If so, it isn't
   * safe to secure a cookie!  We can't always know this for sure because
   * observing cookie-changed doesn't give us enough context to know the
   * full origin URI. In particular, if cookies are set from Javascript (as
   * opposed to HTTP/HTTPS responses), we don't know what page context that
   * Javascript ran in.

   * First, if there are any redirect loops on this domain, don't secure
   * cookies.  XXX This is not a very satisfactory heuristic.  Sometimes we
   * would want to secure the cookie anyway, because the URLs that loop are
   * not authenticated or not important.  Also by the time the loop has been
   * observed and the domain blacklisted, a cookie might already have been
   * flagged as secure.
   *
   * @param domain {string} The cookie's 'domain' attribute.
   * @param rs {Array.<Ruleset>} A list of potentially applicable rulesets.
   * @return {boolean} True if it's safe to secure a cookie on that domain.
   */
  safeToSecureCookie: function(domain, rs) {
    if (domain in https_blacklist_domains) {
      this.log(INFO, "cookies for " + domain + "blacklisted");
      return false;
    }

    // If we passed that test, make up a random URL on the domain, and see if
    // we would HTTPSify that.
    try {
      var nonce_path = "/" + Math.random().toString();
      nonce_path = nonce_path + nonce_path;
      var test_uri = "http://" + domain + nonce_path;
    } catch (e) {
      this.log(WARN, "explosion in safeToSecureCookie for " + domain + "\n" 
                      + "(" + e + ")");
      return false;
    }

    this.log(DBUG, "Testing securecookie applicability with " + test_uri);

    for (var i = 0; i < rs.length; ++i) {
      if (!rs[i].active) continue;
      var rewrite = rs[i].apply(test_uri);
      if (rewrite) {
        this.log(DBUG, "Safe to secure cookie for " + test_uri + ": " + rewrite);
        return true;
      }
    }
    this.log(DBUG, "Unsafe to secure cookie for " + test_uri);
    return false;
  }
};
