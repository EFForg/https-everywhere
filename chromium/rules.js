function Rule(from, to) {
  //this.from = from;
  this.to = to;
  this.from_c = new RegExp(from);
}

function Exclusion(pattern) {
  //this.pattern = pattern;
  this.pattern_c = new RegExp(pattern);
}

function CookieRule(host, cookiename) {
  this.host = host
  this.host_c = new RegExp(host);
  this.name = cookiename;
  this.name_c = new RegExp(cookiename);
}

function RuleSet(set_name, match_rule, default_state, note) {
  this.name = set_name;
  if (match_rule)
    this.ruleset_match_c = new RegExp(match_rule);
  else
    this.ruleset_match_c = null;
  this.rules = [];
  this.exclusions = [];
  this.targets = [];
  this.cookierules = [];
  this.active = default_state;
  this.default_state = default_state;
  this.note = note;
}

RuleSet.prototype = {
  apply: function(urispec) {
    var returl = null;
    // If a rulset has a match_rule and it fails, go no further
    if (this.ruleset_match_c && !this.ruleset_match_c.test(urispec)) {
      log(VERB, "ruleset_match_c excluded " + urispec);
      return null;
    }
    // Even so, if we're covered by an exclusion, go home
    for(var i = 0; i < this.exclusions.length; ++i) {
      if (this.exclusions[i].pattern_c.test(urispec)) {
        log(DBUG,"excluded uri " + urispec);
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
      log(DBUG,"Ruleset "+this.name
              +" had an applicable match-rule but no matching rules");
    }
    return null;
  },

};


function RuleSets() {
  // Load rules into structure
  this.targets = {};

  for(var i = 0; i < rule_list.length; i++) {
    var xhr = new XMLHttpRequest();
    // Use blocking XHR to ensure everything is loaded by the time
    // we return.
    //var that = this;
    //xhr.onreadystatechange = function() { that.loadRuleSet(xhr); }
    xhr.open("GET", chrome.extension.getURL(rule_list[i]), false);
    //xhr.open("GET", chrome.extension.getURL(rule_list[i]), true);
    xhr.send(null);
    this.loadRuleSet(xhr);
  }
  this.global_rulesets = this.targets["*"] ? this.targets["*"] : [];
}

RuleSets.prototype = {
  localPlatformRegexp: new RegExp("chromium"),

  loadRuleSet: function(xhr) {
    // Get file contents
    if (xhr.readyState != 4) {
      return;
    }

    // XXX: Validation + error checking
    var sets = xhr.responseXML.getElementsByTagName("ruleset");
    for (var i = 0; i < sets.length; ++i) {
      this.parseOneRuleset(sets[i]);
    }
  },
  parseOneRuleset: function(ruletag) {
    var default_state = true;
    var note = "";
    if (ruletag.attributes.default_off) {
      default_state = false;
      note += ruletag.attributes.default_off.value + "\n";
    }

    // If a ruleset declares a platform, and we don't match it, treat it as
    // off-by-default
    var platform = ruletag.getAttribute("platform");
    if (platform) {
      if (platform.search(this.localPlatformRegexp) == -1) {
        default_state = false;
      }
      note += "Platform(s): " + platform + "\n";
    }

    var rule_set = new RuleSet(ruletag.getAttribute("name"),
                               ruletag.getAttribute("match_rule"),
                               default_state,
                               note.trim());

    // Read user prefs
    if (rule_set.name in localStorage) {
      rule_set.active = (localStorage[rule_set.name] == "true");
    }

    var rules = ruletag.getElementsByTagName("rule");
    for(var j = 0; j < rules.length; j++) {
      rule_set.rules.push(new Rule(rules[j].getAttribute("from"),
                                    rules[j].getAttribute("to")));
    }

    var exclusions = ruletag.getElementsByTagName("exclusion");
    for(var j = 0; j < exclusions.length; j++) {
      rule_set.exclusions.push(
            new Exclusion(exclusions[j].getAttribute("pattern")));
    }

    var cookierules = ruletag.getElementsByTagName("securecookie");
    for(var j = 0; j < cookierules.length; j++) {
      rule_set.cookierules.push(new CookieRule(cookierules[j].getAttribute("host"),
                                           cookierules[j].getAttribute("name")));
    }

    var targets = ruletag.getElementsByTagName("target");
    for(var j = 0; j < targets.length; j++) {
       var host = targets[j].getAttribute("host");
       if (!(host in this.targets)) {
         this.targets[host] = [];
       }
       this.targets[host].push(rule_set);
    }
  },

  setInsert: function(intoList, fromList) {
    // Insert any elements from fromList into intoList, if they are not
    // already there.  fromList may be null.
    if (!fromList) return;
    for (var i = 0; i < fromList.length; i++)
      if (intoList.indexOf(fromList[i]) == -1)
        intoList.push(fromList[i]);
  },
  
  potentiallyApplicableRulesets: function(host) {
    // Return a list of rulesets that apply to this host
    var i, tmp, t;
    var results = this.global_rulesets.slice(0); // copy global_rulesets
    if (this.targets[host])
      results = results.concat(this.targets[host]);
    // replace each portion of the domain with a * in turn
    var segmented = host.split(".");
    for (i = 0; i < segmented.length; ++i) {
      tmp = segmented[i];
      segmented[i] = "*";
      t = segmented.join(".");
      segmented[i] = tmp;
      this.setInsert(results, this.targets[t]);
    }
    // now eat away from the left, with *, so that for x.y.z.google.com we
    // check *.z.google.com and *.google.com (we did *.y.z.google.com above)
    for (i = 2; i <= segmented.length - 2; ++i) {
      t = "*." + segmented.slice(i,segmented.length).join(".");
      this.setInsert(results, this.targets[t]);
    }
    log(DBUG,"Applicable rules for " + host + ":");
    if (results.length == 0)
      log(DBUG, "  None");
    else
      for (i = 0; i < results.length; ++i)
        log(DBUG, "  " + results[i].name);
    return results;
  },

  shouldSecureCookie: function(cookie, knownHttps) {
    // Check to see if the Cookie object c meets any of our cookierule citeria
    // for being marked as secure.  knownHttps is true if the context for this
    // cookie being set is known to be https.
    //log(DBUG, "Testing cookie:");
    //log(DBUG, "  name: " + cookie.name);
    //log(DBUG, "  host: " + cookie.host);
    //log(DBUG, "  domain: " + cookie.domain);
    //log(DBUG, "  rawhost: " + cookie.rawHost);
    var i,j;
    var hostname = cookie.domain;
    // cookie domain scopes can start with .
    while (hostname.charAt(0) == ".")
      hostname = hostname.slice(1);

    var rs = this.potentiallyApplicableRulesets(hostname);
    for (i = 0; i < rs.length; ++i) {
      var ruleset = rs[i];
      if (ruleset.active) {
        if (!knownHttps && !this.safeToSecureCookie(hostname))
          continue;
        for (j = 0; j < ruleset.cookierules.length; j++) {
          var cr = ruleset.cookierules[j];
          if (cr.host_c.test(cookie.domain) && cr.name_c.test(cookie.name)) {
            return ruleset;
          }
          //log(WARN, "no match domain " + cr.host_c.test(cookie.domain) +
          //          " name " + cr.name_c.test(cookie.name));
          //log(WARN, "with " + cookie.domain + " " + cookie.name);
          //log(WARN, "and " + cr.host + " " + cr.name);
        }
      }
    }
    return null;
  },

  safeToSecureCookie: function(domain) {
    // Check if the domain might be being served over HTTP.  If so, it isn't
    // safe to secure a cookie!  We can't always know this for sure because
    // observing cookie-changed doesn't give us enough context to know the
    // full origin URI.

    // First, if there are any redirect loops on this domain, don't secure
    // cookies.  XXX This is not a very satisfactory heuristic.  Sometimes we
    // would want to secure the cookie anyway, because the URLs that loop are
    // not authenticated or not important.  Also by the time the loop has been
    // observed and the domain blacklisted, a cookie might already have been
    // flagged as secure.

    if (domain in domainBlacklist) {
      log(INFO, "cookies for " + domain + "blacklisted");
      return false;
    }

    // If we passed that test, make up a random URL on the domain, and see if
    // we would HTTPSify that.

    try {
      var nonce_path = "/" + Math.random().toString();
      nonce_path = nonce_path + nonce_path;
      var test_uri = "http://" + domain + nonce_path;
    } catch (e) {
      log(WARN, "explosion in safeToSecureCookie for " + domain + "\n"
                      + "(" + e + ")");
      return false;
    }

    log(INFO, "Testing securecookie applicability with " + test_uri);
    var rs = this.potentiallyApplicableRulesets(domain);
    for (var i = 0; i < rs.length; ++i) {
      if (!rs[i].active) continue;
      var rewrite = rs[i].apply(test_uri);
      if (rewrite) {
        log(INFO, "Yes: " + rewrite);
        return true;
      }
    }
    log(INFO, "(NO)");
    return false;
  },

  rewriteURI: function(urispec, host) {
    var i = 0;
    var newuri = null
    var rs = this.potentiallyApplicableRulesets(host);
    for(i = 0; i < rs.length; ++i) {
      if (rs[i].active && (newuri = rs[i].apply(urispec)))
        return newuri;
    }
    return null;
  },
};

