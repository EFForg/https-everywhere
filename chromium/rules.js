/* globals global: false */
"use strict";

(function(exports) {

// Stubs so this runs under nodejs. They get overwritten later by util.js
if (typeof util == 'undefined' || typeof global != 'undefined') {
  Object.assign(global, {
    util: {
      DBUG: 2,
      INFO: 3,
      WARN: 5,
      log: ()=>{},
    }
  });
}

let settings = {
  enableMixedRulesets: false,
  domainBlacklist: new Set(),
};

// To reduce memory usage for the numerous rules/cookies with trivial rules
const trivial_rule_to = "https:";
const trivial_rule_from_c = new RegExp("^http:");
const trivial_cookie_name_c = new RegExp(".*");
const trivial_cookie_host_c = new RegExp(".*");

/**
 * A single rule
 * @param from
 * @param to
 * @constructor
 */
function Rule(from, to) {
  if (from === "^http:" && to === "https:") {
    // This is a trivial rule, rewriting http->https with no complex RegExp.
    this.to = trivial_rule_to;
    this.from_c = trivial_rule_from_c;
  } else {
    // This is a non-trivial rule.
    this.to = to;
    this.from_c = new RegExp(from);
  }
}

/**
 * Regex-Compile a pattern
 * @param pattern The pattern to compile
 * @constructor
 */
function Exclusion(pattern) {
  this.pattern_c = new RegExp(pattern);
}

/**
 * Generates a CookieRule
 * @param host The host regex to compile
 * @param cookiename The cookie name Regex to compile
 * @constructor
 */
function CookieRule(host, cookiename) {
  if (host === ".*" || host === ".+" || host === ".") {
    // Some cookie rules trivially match any host.
    this.host_c = trivial_cookie_host_c;
  } else {
    this.host_c = new RegExp(host);
  }

  if (cookiename === ".*" || cookiename === ".+" || cookiename === ".") {
    // About 50% of cookie rules trivially match any name.
    this.name_c = trivial_cookie_name_c;
  } else {
    this.name_c = new RegExp(cookiename);
  }
}

/**
 *A collection of rules
 * @param set_name The name of this set
 * @param default_state activity state
 * @param note Note will be displayed in popup
 * @constructor
 */
function RuleSet(set_name, default_state, note) {
  this.name = set_name;
  this.rules = [];
  this.exclusions = null;
  this.cookierules = null;
  this.active = default_state;
  this.default_state = default_state;
  this.note = note;
}

RuleSet.prototype = {
  /**
   * Check if a URI can be rewritten and rewrite it
   * @param urispec The uri to rewrite
   * @returns {*} null or the rewritten uri
   */
  apply: function(urispec) {
    var returl = null;
    // If we're covered by an exclusion, go home
    if (this.exclusions !== null) {
      for (let exclusion of this.exclusions) {
        if (exclusion.pattern_c.test(urispec)) {
          util.log(util.DBUG, "excluded uri " + urispec);
          return null;
        }
      }
    }

    // Okay, now find the first rule that triggers
    for (let rule of this.rules) {
      returl = urispec.replace(rule.from_c,
        rule.to);
      if (returl != urispec) {
        return returl;
      }
    }
    return null;
  },

  /**
   * Deep equivalence comparison
   * @param ruleset The ruleset to compare with
   * @returns true or false, depending on whether it's deeply equivalent
   */
  isEquivalentTo: function(ruleset) {
    if(this.name != ruleset.name ||
       this.note != ruleset.note ||
       this.state != ruleset.state ||
       this.default_state != ruleset.default_state) {
      return false;
    }

    try {
      var this_exclusions_length = this.exclusions.length;
    } catch(e) {
      var this_exclusions_length = 0;
    }

    try {
      var ruleset_exclusions_length = ruleset.exclusions.length;
    } catch(e) {
      var ruleset_exclusions_length = 0;
    }

    try {
      var this_rules_length = this.rules.length;
    } catch(e) {
      var this_rules_length = 0;
    }

    try {
      var ruleset_rules_length = ruleset.rules.length;
    } catch(e) {
      var ruleset_rules_length = 0;
    }

    if(this_exclusions_length != ruleset_exclusions_length ||
       this_rules_length != ruleset_rules_length) {
      return false;
    }
    if(this_exclusions_length > 0) {
      for(let x = 0; x < this.exclusions.length; x++){
        if(this.exclusions[x].pattern_c != ruleset.exclusions[x].pattern_c) {
          return false;
        }
      }
    }
    if(this_rules_length > 0) {
      for(let x = 0; x < this.rules.length; x++){
        if(this.rules[x].to != ruleset.rules[x].to) {
          return false;
        }
      }
    }
    return true;
  }

};

/**
 * Initialize Rule Sets
 * @param ruleActiveStates default state for rules
 * @constructor
 */
function RuleSets() {
  // Load rules into structure
  this.targets = new Map();

  // A cache for potentiallyApplicableRulesets
  this.ruleCache = new Map();

  // A cache for cookie hostnames.
  this.cookieHostCache = new Map();

  // A hash of rule name -> active status (true/false).
  this.ruleActiveStates = {};

  // The key to retrieve user rules from localStorage
  this.USER_RULE_KEY = 'userRules';
}


RuleSets.prototype = {

  initialize: async function() {
    this.ruleActiveStates = store.localStorage;
    this.addFromJson(util.loadExtensionFile('rules/default.rulesets', 'json'));
    this.loadStoredUserRules();
    await this.addStoredCustomRulesets();
  },

  /**
   * Iterate through data XML and load rulesets
   */
  addFromXml: function(ruleXml) {
    var sets = ruleXml.getElementsByTagName("ruleset");
    for (let s of sets) {
      try {
        this.parseOneXmlRuleset(s);
      } catch (e) {
        util.log(util.WARN, 'Error processing ruleset:' + e);
      }
    }
  },

  addFromJson: function(ruleJson) {
    for (let ruleset of ruleJson) {
      try {
        this.parseOneJsonRuleset(ruleset);
      } catch(e) {
        util.log(util.WARN, 'Error processing ruleset:' + e);
      }
    }
  },

  parseOneJsonRuleset: function(ruletag) {
    var default_state = true;
    var note = "";
    var default_off = ruletag["default_off"];
    if (default_off) {
      default_state = false;
      note += default_off + "\n";
    }

    // If a ruleset declares a platform, and we don't match it, treat it as
    // off-by-default. In practice, this excludes "mixedcontent" & "cacert" rules.
    var platform = ruletag["platform"]
    if (platform) {
      default_state = false;
      if (platform == "mixedcontent" && settings.enableMixedRulesets) {
        default_state = true;
      }
      note += "Platform(s): " + platform + "\n";
    }

    var rule_set = new RuleSet(ruletag["name"], default_state, note.trim());

    // Read user prefs
    if (rule_set.name in this.ruleActiveStates) {
      rule_set.active = (this.ruleActiveStates[rule_set.name] == "true");
    }

    var rules = ruletag["rule"];
    for (let rule of rules) {
      if (rule["from"] != null && rule["to"] != null) {
        rule_set.rules.push(new Rule(rule["from"], rule["to"]));
      }
    }

    var exclusions = ruletag["exclusion"];
    if (exclusions != null) {
      for (let exclusion of exclusions) {
        if (exclusion != null) {
          if (!rule_set.exclusions) {
            rule_set.exclusions = [];
          }
          rule_set.exclusions.push(new Exclusion(exclusion));
        }
      }
    }

    var cookierules = ruletag["securecookie"];
    if (cookierules != null) {
      for (let cookierule of cookierules) {
        if (cookierule["host"] != null && cookierule["name"] != null) {
          if (!rule_set.cookierules) {
            rule_set.cookierules = [];
          }
          rule_set.cookierules.push(new CookieRule(cookierule["host"], cookierule["name"]));
        }
      }
    }

    var targets = ruletag["target"];
    for (let target of targets) {
      if (target != null) {
        if (!this.targets.has(target)) {
          this.targets.set(target, []);
        }
        this.targets.get(target).push(rule_set);
      }
    }
  },

  /**
   * Load a user rule
   * @param params
   * @returns {boolean}
   */
  addUserRule : function(params) {
    util.log(util.INFO, 'adding new user rule for ' + JSON.stringify(params));
    var new_rule_set = new RuleSet(params.host, true, "user rule");
    var new_rule = new Rule(params.urlMatcher, params.redirectTo);
    new_rule_set.rules.push(new_rule);
    if (!this.targets.has(params.host)) {
      this.targets.set(params.host, []);
    }
    this.ruleCache.delete(params.host);
    // TODO: maybe promote this rule?
    this.targets.get(params.host).push(new_rule_set);
    if (new_rule_set.name in this.ruleActiveStates) {
      new_rule_set.active = (this.ruleActiveStates[new_rule_set.name] == "true");
    }
    util.log(util.INFO, 'done adding rule');
    return true;
  },

  /**
   * Remove a user rule
   * @param params
   * @returns {boolean}
   */
  removeUserRule: function(ruleset) {
    util.log(util.INFO, 'removing user rule for ' + JSON.stringify(ruleset));
    this.ruleCache.delete(ruleset.name);


    var tmp = this.targets.get(ruleset.name).filter(r =>
      !(r.isEquivalentTo(ruleset))
    );
    this.targets.set(ruleset.name, tmp);

    if (this.targets.get(ruleset.name).length == 0) {
      this.targets.delete(ruleset.name);
    }

    util.log(util.INFO, 'done removing rule');
    return true;
  },
  
  /**
  * Retrieve stored user rules from localStorage
  **/
  getStoredUserRules: function() {
    const oldUserRuleString = store.localStorage.getItem(this.USER_RULE_KEY);
    let oldUserRules = [];
    if (oldUserRuleString) {
      oldUserRules = JSON.parse(oldUserRuleString);
    }
    return oldUserRules;
  },

  /**
  * Load all stored user rules into this RuleSet object
  */
  loadStoredUserRules: function() {
    const user_rules = this.getStoredUserRules();
    for (let user_rule of user_rules) {
      this.addUserRule(user_rule);
    }
    util.log(util.INFO, 'loaded ' + user_rules.length + ' stored user rules');
  },

  /**
  * Adds a new user rule
  * @param params: params defining the rule
  * @param cb: Callback to call after success/fail
  * */
  addNewRuleAndStore: function(params) {
    if (this.addUserRule(params)) {
      // If we successfully added the user rule, save it in local
      // storage so it's automatically applied when the extension is
      // reloaded.
      var oldUserRules = this.getStoredUserRules();
      // TODO: there's a race condition here, if this code is ever executed from multiple
      // client windows in different event loops.
      oldUserRules.push(params);
      // TODO: can we exceed the max size for storage?
      store.localStorage.setItem(this.USER_RULE_KEY, JSON.stringify(oldUserRules));
    }
  },

  /**
  * Removes a user rule
  * @param ruleset: the ruleset to remove
  * */
  removeRuleAndStore: function(ruleset) {
    if (this.removeUserRule(ruleset)) {
      // If we successfully removed the user rule, remove it in local storage too
      var userRules = this.getStoredUserRules();
      userRules = userRules.filter(r =>
        !(r.host == ruleset.name &&
          r.redirectTo == ruleset.rules[0].to)
      );
      store.localStorage.setItem(this.USER_RULE_KEY, JSON.stringify(userRules));
    }
  },

  addStoredCustomRulesets: function(){
    return new Promise(resolve => {
      store.get({
        legacy_custom_rulesets: [],
        debugging_rulesets: ""
      }, item => {
        this.loadCustomRulesets(item.legacy_custom_rulesets);
        this.loadCustomRuleset(item.debugging_rulesets);
        resolve();
      });
    });
  },

  // Load in the legacy custom rulesets, if any
  loadCustomRulesets: function(legacy_custom_rulesets){
    for(let legacy_custom_ruleset of legacy_custom_rulesets){
      this.loadCustomRuleset(legacy_custom_ruleset);
    }
  },

  loadCustomRuleset: function(ruleset_string){
    this.addFromXml((new DOMParser()).parseFromString(ruleset_string, 'text/xml'));
  },

  /**
   * Does the loading of a ruleset.
   * @param ruletag The whole <ruleset> tag to parse
   */
  parseOneXmlRuleset: function(ruletag) {
    var default_state = true;
    var note = "";
    var default_off = ruletag.getAttribute("default_off");
    if (default_off) {
      default_state = false;
      note += default_off + "\n";
    }

    // If a ruleset declares a platform, and we don't match it, treat it as
    // off-by-default. In practice, this excludes "mixedcontent" & "cacert" rules.
    var platform = ruletag.getAttribute("platform");
    if (platform) {
      default_state = false;
      if (platform == "mixedcontent" && settings.enableMixedRulesets) {
        default_state = true;
      }
      note += "Platform(s): " + platform + "\n";
    }

    var rule_set = new RuleSet(ruletag.getAttribute("name"),
      default_state,
      note.trim());

    // Read user prefs
    if (rule_set.name in this.ruleActiveStates) {
      rule_set.active = (this.ruleActiveStates[rule_set.name] == "true");
    }

    var rules = ruletag.getElementsByTagName("rule");
    for (let rule of rules) {
      rule_set.rules.push(new Rule(rule.getAttribute("from"),
        rule.getAttribute("to")));
    }

    var exclusions = ruletag.getElementsByTagName("exclusion");
    if (exclusions.length > 0) {
      rule_set.exclusions = [];
      for (let exclusion of exclusions) {
        rule_set.exclusions.push(
          new Exclusion(exclusion.getAttribute("pattern")));
      }
    }

    var cookierules = ruletag.getElementsByTagName("securecookie");
    if (cookierules.length > 0) {
      rule_set.cookierules = [];
      for (let cookierule of cookierules) {
        rule_set.cookierules.push(
          new CookieRule(cookierule.getAttribute("host"),
            cookierule.getAttribute("name")));
      }
    }

    var targets = ruletag.getElementsByTagName("target");
    for (let target of targets) {
      var host = target.getAttribute("host");
      if (!this.targets.has(host)) {
        this.targets.set(host, []);
      }
      this.targets.get(host).push(rule_set);
    }
  },

  /**
   * Return a list of rulesets that apply to this host
   * @param host The host to check
   * @returns {*} (empty) list
   */
  potentiallyApplicableRulesets: function(host) {
    // Have we cached this result? If so, return it!
    var cached_item = this.ruleCache.get(host);
    if (cached_item !== undefined) {
      util.log(util.DBUG, "Ruleset cache hit for " + host + " items:" + cached_item.length);
      return cached_item;
    }
    util.log(util.DBUG, "Ruleset cache miss for " + host);

    var results = [];
    if (this.targets.has(host)) {
      // Copy the host targets so we don't modify them.
      results = results.concat(this.targets.get(host));
    }

    // Ensure host is well-formed (RFC 1035)
    if (host.indexOf("..") != -1 || host.length > 255) {
      util.log(util.WARN,"Malformed host passed to potentiallyApplicableRulesets: " + host);
      return null;
    }

    // Replace each portion of the domain with a * in turn
    var segmented = host.split(".");
    for (let i=0; i < segmented.length; i++) {
      let tmp = segmented[i];
      segmented[i] = "*";
      results = results.concat(this.targets.get(segmented.join(".")));
      segmented[i] = tmp;
    }
    // now eat away from the left, with *, so that for x.y.z.google.com we
    // check *.z.google.com and *.google.com (we did *.y.z.google.com above)
    for (var i = 2; i <= segmented.length - 2; ++i) {
      var t = "*." + segmented.slice(i,segmented.length).join(".");
      results = results.concat(this.targets.get(t));
    }

    // Clean the results list, which may contain duplicates or undefined entries
    var resultSet = new Set(results);
    resultSet.delete(undefined);

    util.log(util.DBUG,"Applicable rules for " + host + ":");
    if (resultSet.size == 0) {
      util.log(util.DBUG, "  None");
    } else {
      for (let target of resultSet.values()) {
        util.log(util.DBUG, "  " + target.name);
      }
    }

    // Insert results into the ruleset cache
    this.ruleCache.set(host, resultSet);

    // Cap the size of the cache. (Limit chosen somewhat arbitrarily)
    if (this.ruleCache.size > 1000) {
      // Map.prototype.keys() returns keys in insertion order, so this is a FIFO.
      this.ruleCache.delete(this.ruleCache.keys().next().value);
    }

    return resultSet;
  },

  /**
   * Check to see if the Cookie object c meets any of our cookierule criteria for being marked as secure.
   * @param cookie The cookie to test
   * @returns {*} ruleset or null
   */
  shouldSecureCookie: function(cookie) {
    var hostname = cookie.domain;
    // cookie domain scopes can start with .
    while (hostname.charAt(0) == ".") {
      hostname = hostname.slice(1);
    }

    if (!this.safeToSecureCookie(hostname)) {
      return null;
    }

    var potentiallyApplicable = this.potentiallyApplicableRulesets(hostname);
    for (let ruleset of potentiallyApplicable) {
      if (ruleset.cookierules !== null && ruleset.active) {
        for (let cookierules of ruleset.cookierules) {
          var cr = cookierules;
          if (cr.host_c.test(cookie.domain) && cr.name_c.test(cookie.name)) {
            return ruleset;
          }
        }
      }
    }
    return null;
  },

  /**
   * Check if it is secure to secure the cookie (=patch the secure flag in).
   * @param domain The domain of the cookie
   * @returns {*} true or false
   */
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

    if (settings.domainBlacklist.has(domain)) {
      util.log(util.INFO, "cookies for " + domain + "blacklisted");
      return false;
    }
    var cached_item = this.cookieHostCache.get(domain);
    if (cached_item !== undefined) {
      util.log(util.DBUG, "Cookie host cache hit for " + domain);
      return cached_item;
    }
    util.log(util.DBUG, "Cookie host cache miss for " + domain);

    // If we passed that test, make up a random URL on the domain, and see if
    // we would HTTPSify that.

    var nonce_path = "/" + Math.random().toString();
    var test_uri = "http://" + domain + nonce_path + nonce_path;

    // Cap the size of the cookie cache (limit chosen somewhat arbitrarily)
    if (this.cookieHostCache.size > 250) {
      // Map.prototype.keys() returns keys in insertion order, so this is a FIFO.
      this.cookieHostCache.delete(this.cookieHostCache.keys().next().value);
    }

    util.log(util.INFO, "Testing securecookie applicability with " + test_uri);
    var potentiallyApplicable = this.potentiallyApplicableRulesets(domain);
    for (let ruleset of potentiallyApplicable) {
      if (!ruleset.active) {
        continue;
      }
      if (ruleset.apply(test_uri)) {
        util.log(util.INFO, "Cookie domain could be secured.");
        this.cookieHostCache.set(domain, true);
        return true;
      }
    }
    util.log(util.INFO, "Cookie domain could NOT be secured.");
    this.cookieHostCache.set(domain, false);
    return false;
  },

  /**
   * Rewrite an URI
   * @param urispec The uri to rewrite
   * @param host The host of this uri
   * @returns {*} the new uri or null
   */
  rewriteURI: function(urispec, host) {
    var newuri = null;
    var potentiallyApplicable = this.potentiallyApplicableRulesets(host);
    for (let ruleset of potentiallyApplicable) {
      if (ruleset.active && (newuri = ruleset.apply(urispec))) {
        return newuri;
      }
    }
    return null;
  }
};

Object.assign(exports, {
  settings,
  RuleSets
});

})(typeof exports == 'undefined' ? window.rules = {} : exports);
