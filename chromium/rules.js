"use strict";
// Stubs so this runs under nodejs. They get overwritten later by util.js
var VERB=1;
var DBUG=2;
var INFO=3;
var NOTE=4;
var WARN=5;
function log(){}

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
      for (var i = 0; i < this.exclusions.length; ++i) {
        if (this.exclusions[i].pattern_c.test(urispec)) {
          log(DBUG, "excluded uri " + urispec);
          return null;
        }
      }
    }

    // Okay, now find the first rule that triggers
    for(var i = 0; i < this.rules.length; ++i) {
      returl = urispec.replace(this.rules[i].from_c,
                               this.rules[i].to);
      if (returl != urispec) {
        return returl;
      }
    }
    return null;
  }

};

/**
 * Initialize Rule Sets
 * @param ruleActiveStates default state for rules
 * @constructor
 */
function RuleSets(ruleActiveStates) {
  // Load rules into structure
  this.targets = {};

  // A cache for potentiallyApplicableRulesets
  this.ruleCache = new Map();

  // A cache for cookie hostnames.
  this.cookieHostCache = new Map();

  // A hash of rule name -> active status (true/false).
  this.ruleActiveStates = ruleActiveStates;

  // A regex to match platform-specific features
  this.localPlatformRegexp = new RegExp("chromium");
}


RuleSets.prototype = {
  /**
   * Iterate through data XML and load rulesets
   */
  addFromXml: function(ruleXml) {
    var sets = ruleXml.getElementsByTagName("ruleset");
    for (var i = 0; i < sets.length; ++i) {
      try {
        this.parseOneRuleset(sets[i]);
      } catch (e) {
        log(WARN, 'Error processing ruleset:' + e);
      }
    }
  },

  /**
   * Load a user rule
   * @param params
   * @returns {boolean}
   */
  addUserRule : function(params) {
    log(INFO, 'adding new user rule for ' + JSON.stringify(params));
    var new_rule_set = new RuleSet(params.host, true, "user rule");
    var new_rule = new Rule(params.urlMatcher, params.redirectTo);
    new_rule_set.rules.push(new_rule);
    if (!(params.host in this.targets)) {
      this.targets[params.host] = [];
    }
    this.ruleCache.delete(params.host);
    // TODO: maybe promote this rule?
    this.targets[params.host].push(new_rule_set);
    if (new_rule_set.name in this.ruleActiveStates) {
      new_rule_set.active = (this.ruleActiveStates[new_rule_set.name] == "true");
    }
    log(INFO, 'done adding rule');
    return true;
  },

  /**
   * Does the loading of a ruleset.
   * @param ruletag The whole <ruleset> tag to parse
   */
  parseOneRuleset: function(ruletag) {
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
      if (platform.search(this.localPlatformRegexp) == -1) {
        default_state = false;
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
    for(var j = 0; j < rules.length; j++) {
      rule_set.rules.push(new Rule(rules[j].getAttribute("from"),
                                    rules[j].getAttribute("to")));
    }

    var exclusions = ruletag.getElementsByTagName("exclusion");
    if (exclusions.length > 0) {
      rule_set.exclusions = [];
      for (var j = 0; j < exclusions.length; j++) {
        rule_set.exclusions.push(
            new Exclusion(exclusions[j].getAttribute("pattern")));
      }
    }

    var cookierules = ruletag.getElementsByTagName("securecookie");
    if (cookierules.length > 0) {
      rule_set.cookierules = [];
      for(var j = 0; j < cookierules.length; j++) {
        rule_set.cookierules.push(
            new CookieRule(cookierules[j].getAttribute("host"),
                cookierules[j].getAttribute("name")));
      }
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

  /**
   * Return a list of rulesets that apply to this host
   * @param host The host to check
   * @returns {*} (empty) list
   */
  potentiallyApplicableRulesets: function(host) {
    // Have we cached this result? If so, return it!
    var cached_item = this.ruleCache.get(host);
    if (cached_item !== undefined) {
        log(DBUG, "Ruleset cache hit for " + host + " items:" + cached_item.length);
        return cached_item;
    }
    log(DBUG, "Ruleset cache miss for " + host);

    var tmp;
    var results = [];
    if (this.targets[host]) {
      // Copy the host targets so we don't modify them.
      results = results.concat(this.targets[host]);
    }

    // Ensure host is well-formed (RFC 1035)
    if (host.indexOf("..") != -1 || host.length > 255) {
      log(WARN,"Malformed host passed to potentiallyApplicableRulesets: " + host);
      return null;
    }

    // Replace each portion of the domain with a * in turn
    var segmented = host.split(".");
    for (var i = 0; i < segmented.length; ++i) {
      tmp = segmented[i];
      segmented[i] = "*";
      results = results.concat(this.targets[segmented.join(".")]);
      segmented[i] = tmp;
    }
    // now eat away from the left, with *, so that for x.y.z.google.com we
    // check *.z.google.com and *.google.com (we did *.y.z.google.com above)
    for (var i = 2; i <= segmented.length - 2; ++i) {
      var t = "*." + segmented.slice(i,segmented.length).join(".");
      results = results.concat(this.targets[t]);
    }

    // Clean the results list, which may contain duplicates or undefined entries
    var resultSet = new Set(results);
    resultSet.delete(undefined);

    log(DBUG,"Applicable rules for " + host + ":");
    if (resultSet.size == 0) {
      log(DBUG, "  None");
    } else {
      for (let target of resultSet.values()) {
        log(DBUG, "  " + target.name);
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
        for (var j = 0; j < ruleset.cookierules.length; j++) {
          var cr = ruleset.cookierules[j];
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

    if (domainBlacklist.has(domain)) {
      log(INFO, "cookies for " + domain + "blacklisted");
      return false;
    }
    var cached_item = this.cookieHostCache.get(domain);
    if (cached_item !== undefined) {
        log(DBUG, "Cookie host cache hit for " + domain);
        return cached_item;
    }
    log(DBUG, "Cookie host cache miss for " + domain);

    // If we passed that test, make up a random URL on the domain, and see if
    // we would HTTPSify that.

    var nonce_path = "/" + Math.random().toString();
    var test_uri = "http://" + domain + nonce_path + nonce_path;

    // Cap the size of the cookie cache (limit chosen somewhat arbitrarily)
    if (this.cookieHostCache.size > 250) {
      // Map.prototype.keys() returns keys in insertion order, so this is a FIFO.
      this.cookieHostCache.delete(this.cookieHostCache.keys().next().value);
    }

    log(INFO, "Testing securecookie applicability with " + test_uri);
    var potentiallyApplicable = this.potentiallyApplicableRulesets(domain);
    for (let ruleset of potentiallyApplicable) {
      if (!ruleset.active) {
        continue;
      }
      if (ruleset.apply(test_uri)) {
        log(INFO, "Cookie domain could be secured.");
        this.cookieHostCache.set(domain, true);
        return true;
      }
    }
    log(INFO, "Cookie domain could NOT be secured.");
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

// Export for HTTPS Rewriter if applicable.
if (typeof exports != 'undefined') {
  exports.RuleSets = RuleSets;
}
