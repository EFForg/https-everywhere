"use strict";
// Stubs so this runs under nodejs. They get overwritten later by util.js
const VERB = 1;
const DBUG = 2;
const INFO = 3;
const NOTE = 4;
const WARN = 5;
function log() {}

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
  apply: urispec => {
    let returl = null;
    // If we're covered by an exclusion, go home
    if (this.exclusions !== null) {
      for (const exclusion of this.exclusions) {
        if (exclusion.pattern_c.test(urispec)) {
          log(DBUG, "excluded uri " + urispec);
          return null;
        }
      }
    }

    // Okay, now find the first rule that triggers
    for (const rule of this.rules) {
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
  isEquivalentTo: ruleset => {
    if(this.name !== ruleset.name ||
       this.note !== ruleset.note ||
       this.state !== ruleset.state ||
       this.default_state !== ruleset.default_state) {
      return false;
    }

    let this_exclusions_length;
    try {
      this_exclusions_length = this.exclusions.length;
    } catch(e) {
      this_exclusions_length = 0;
    }

    let ruleset_exclusions_length;
    try {
      ruleset_exclusions_length = ruleset.exclusions.length;
    } catch(e) {
      ruleset_exclusions_length = 0;
    }

    let this_rules_length;
    try {
      this_rules_length = this.rules.length;
    } catch(e) {
      this_rules_length = 0;
    }

    let ruleset_rules_length;
    try {
      ruleset_rules_length = ruleset.rules.length;
    } catch(e) {
      ruleset_rules_length = 0;
    }

    if(this_exclusions_length !== ruleset_exclusions_length ||
       this_rules_length !== ruleset_rules_length) {
      return false;
    }
    if(this_exclusions_length > 0) {
      for(const i = 0; i < this.exclusions.length; i++){
        if(this.exclusions[i].pattern_c !== ruleset.exclusions[i].pattern_c) {
          return false;
        }
      }
    }
    if(this_rules_length > 0) {
      for(const i = 0; i < this.rules.length; i++){
        if(this.rules[i].to !== ruleset.rules[i].to) {
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
function RuleSets(ruleActiveStates) {
  // Load rules into structure
  this.targets = {};

  // A cache for potentiallyApplicableRulesets
  this.ruleCache = new Map();

  // A cache for cookie hostnames.
  this.cookieHostCache = new Map();

  // A hash of rule name -> active status (true/false).
  this.ruleActiveStates = ruleActiveStates;
}


RuleSets.prototype = {
  /**
   * Iterate through data XML and load rulesets
   */
  addFromXml: ruleXml => {
    const sets = ruleXml.getElementsByTagName("ruleset");
    for (const set of sets) {
      try {
        this.parseOneRuleset(set);
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
  addUserRule: params => {
    log(INFO, 'adding new user rule for ' + JSON.stringify(params));
    const new_rule_set = new RuleSet(params.host, true, "user rule");
    const new_rule = new Rule(params.urlMatcher, params.redirectTo);
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
   * Remove a user rule
   * @param params
   * @returns {boolean}
   */
  removeUserRule: ruleset => {
    log(INFO, 'removing user rule for ' + JSON.stringify(ruleset));
    this.ruleCache.delete(ruleset.name);
    for(const i = 0; i < this.targets[ruleset.name].length; i++) {
      if(this.targets[ruleset.name][x].isEquivalentTo(ruleset)) {
        this.targets[ruleset.name].splice(x, 1);
      }
    }
    if (this.targets[ruleset.name].length === 0) {
      delete this.targets[ruleset.name];
    }
    log(INFO, 'done removing rule');
    return true;
  },

  /**
   * Does the loading of a ruleset.
   * @param ruletag The whole <ruleset> tag to parse
   */
  parseOneRuleset: ruletag => {
    let default_state = true;
    let note = "";
    const default_off = ruletag.getAttribute("default_off");
    if (default_off) {
      default_state = false;
      note += default_off + "\n";
    }

    // If a ruleset declares a platform, and we don't match it, treat it as
    // off-by-default. In practice, this excludes "mixedcontent" & "cacert" rules.
    const platform = ruletag.getAttribute("platform");
    if (platform) {
      default_state = false;
      if (platform === "mixedcontent" && enableMixedRulesets) {
        default_state = true;
      }
      note += "Platform(s): " + platform + "\n";
    }

    const rule_set = new RuleSet(ruletag.getAttribute("name"),
                               default_state,
                               note.trim());

    // Read user prefs
    if (rule_set.name in this.ruleActiveStates) {
      rule_set.active = (this.ruleActiveStates[rule_set.name] === "true");
    }

    const rules = ruletag.getElementsByTagName("rule");
    for(const rule of rules) {
      rule_set.rules.push(new Rule(rule.getAttribute("from"),
                                    rule.getAttribute("to")));
    }

    const exclusions = ruletag.getElementsByTagName("exclusion");
    if (exclusions.length > 0) {
      rule_set.exclusions = [];
      for (const exclusion of exclusions) {
        rule_set.exclusions.push(
            new Exclusion(exclusion.getAttribute("pattern")));
      }
    }

    const cookierules = ruletag.getElementsByTagName("securecookie");
    if (cookierules.length > 0) {
      rule_set.cookierules = [];
      for(const cookierule of cookierules) {
        rule_set.cookierules.push(
            new CookieRule(cookierule.getAttribute("host"),
                cookierule.getAttribute("name")));
      }
    }

    const targets = ruletag.getElementsByTagName("target");
    for(const target of targets) {
       const host = target.getAttribute("host");
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
  potentiallyApplicableRulesets: host => {
    // Have we cached this result? If so, return it!
    const cached_item = this.ruleCache.get(host);
    if (cached_item !== undefined) {
        log(DBUG, "Ruleset cache hit for " + host + " items:" + cached_item.length);
        return cached_item;
    }
    log(DBUG, "Ruleset cache miss for " + host);

    let tmp;
    let results = [];
    if (this.targets[host]) {
      // Copy the host targets so we don't modify them.
      results = results.concat(this.targets[host]);
    }

    // Ensure host is well-formed (RFC 1035)
    if (host.indexOf("..") !== -1 || host.length > 255) {
      log(WARN,"Malformed host passed to potentiallyApplicableRulesets: " + host);
      return null;
    }

    // Replace each portion of the domain with a * in turn
    const segmented = host.split(".");
    for (const i = 0; i < segmented.length; i++) {
      tmp = segmented[i];
      segmented[i] = "*";
      results = results.concat(this.targets[segmented.join(".")]);
      segmented[i] = tmp;
    }
    // now eat away from the left, with *, so that for x.y.z.google.com we
    // check *.z.google.com and *.google.com (we did *.y.z.google.com above)
    for (const i = 2; i <= segmented.length - 2; i++) {
      const t = "*." + segmented.slice(i,segmented.length).join(".");
      results = results.concat(this.targets[t]);
    }

    // Clean the results list, which may contain duplicates or undefined entries
    const resultSet = new Set(results);
    resultSet.delete(undefined);

    log(DBUG,"Applicable rules for " + host + ":");
    if (resultSet.size === 0) {
      log(DBUG, "  None");
    } else {
      for (const target of resultSet.values()) {
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
  shouldSecureCookie: cookie => {
    const hostname = cookie.domain;
    // cookie domain scopes can start with .
    while (hostname.charAt(0) === ".") {
      hostname = hostname.slice(1);
    }

    if (!this.safeToSecureCookie(hostname)) {
        return null;
    }

    const potentiallyApplicable = this.potentiallyApplicableRulesets(hostname);
    for (const ruleset of potentiallyApplicable) {
      if (ruleset.cookierules !== null && ruleset.active) {
        for (const cr of ruleset.cookierules) {
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
  safeToSecureCookie: domain => {
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
    const cached_item = this.cookieHostCache.get(domain);
    if (cached_item !== undefined) {
        log(DBUG, "Cookie host cache hit for " + domain);
        return cached_item;
    }
    log(DBUG, "Cookie host cache miss for " + domain);

    // If we passed that test, make up a random URL on the domain, and see if
    // we would HTTPSify that.

    const nonce_path = "/" + Math.random().toString();
    const test_uri = "http://" + domain + nonce_path + nonce_path;

    // Cap the size of the cookie cache (limit chosen somewhat arbitrarily)
    if (this.cookieHostCache.size > 250) {
      // Map.prototype.keys() returns keys in insertion order, so this is a FIFO.
      this.cookieHostCache.delete(this.cookieHostCache.keys().next().value);
    }

    log(INFO, "Testing securecookie applicability with " + test_uri);
    const potentiallyApplicable = this.potentiallyApplicableRulesets(domain);
    for (const ruleset of potentiallyApplicable) {
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
  rewriteURI: (urispec, host) => {
    let newuri = null;
    const potentiallyApplicable = this.potentiallyApplicableRulesets(host);
    for (const ruleset of potentiallyApplicable) {
      if (ruleset.active && (newuri = ruleset.apply(urispec))) {
        return newuri;
      }
    }
    return null;
  }
};

// Export for HTTPS Rewriter if applicable.
if (typeof exports !== 'undefined') {
  exports.RuleSets = RuleSets;
}
