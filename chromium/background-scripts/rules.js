"use strict";

(function(exports) {

const util = require('./util'),
  wasm = require('./wasm');

let settings = {
  enableMixedRulesets: false,
  domainBlacklist: new Set(),
};

// To reduce memory usage for the numerous rules/cookies with trivial rules
const trivial_cookie_rule_c = /.+/;

/* A map of all scope RegExp objects */
const scopes = new Map();

/**
 * Returns the scope object from the map for the given scope string.
 * @param {string} scope ruleset scope string
 * @returns {RegExp}
 */
function getScope(scope) {
  if (!scopes.has(scope)) {
    scopes.set(scope, new RegExp(scope));
  }
  return scopes.get(scope);
}

/**
 * Constructs a single rule
 * @param from
 * @param to
 * @constructor
 */
function Rule(from, to) {
  this.from_c = new RegExp(from);
  this.to = to;
}

// To reduce memory usage for the numerous rules/cookies with trivial rules
const trivial_rule = new Rule("^http:", "https:");

/**
 * Returns a common trivial rule or constructs a new one.
 */
function getRule(from, to) {
  if (from === "^http:" && to === "https:") {
    // This is a trivial rule, rewriting http->https with no complex RegExp.
    return trivial_rule;
  } else {
    // This is a non-trivial rule.
    return new Rule(from, to);
  }
}

/**
 * Generates a CookieRule
 * @param host The host regex to compile
 * @param cookiename The cookie name Regex to compile
 * @constructor
 */
function CookieRule(host, cookiename) {
  if (host === '.+') {
    // Some cookie rules trivially match any host.
    this.host_c = trivial_cookie_rule_c;
  } else {
    this.host_c = new RegExp(host);
  }

  if (cookiename === '.+') {
    // About 50% of cookie rules trivially match any name.
    this.name_c = trivial_cookie_rule_c;
  } else {
    this.name_c = new RegExp(cookiename);
  }
}

/**
 *A collection of rules
 * @param {string} set_name The name of this set
 * @param {boolean} default_state activity state
 * @param {string} scope ruleset scope string
 * @param {string} note Note will be displayed in popup
 * @constructor
 */
function RuleSet(set_name, default_state, scope, note) {
  this.name = set_name;
  this.rules = [];
  this.exclusions = null;
  this.cookierules = null;
  this.active = default_state;
  this.default_state = default_state;
  this.scope = getScope(scope);
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
    if (this.exclusions !== null && this.exclusions.test(urispec)) {
      util.log(util.DBUG, "excluded uri " + urispec);
      return null;
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
       this.active != ruleset.active ||
       this.default_state != ruleset.default_state) {
      return false;
    }

    try {
      var this_exclusions_source = this.exclusions.source;
    } catch(e) {
      var this_exclusions_source = null;
    }

    try {
      var ruleset_exclusions_source = ruleset.exclusions.source;
    } catch(e) {
      var ruleset_exclusions_source = null;
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

    if(this_rules_length != ruleset_rules_length) {
      return false;
    }

    if (this_exclusions_source != ruleset_exclusions_source) {
      return false;
    }

    if(this_rules_length > 0) {
      for(let x = 0; x < this.rules.length; x++) {
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
 * @constructor
 */
function RuleSets() {
  // Load rules into structure
  this.targets = new Map();

  // A cache for potentiallyApplicableRulesets
  this.ruleCache = new Map();

  // A cache for cookie hostnames.
  this.cookieHostCache = new Map();

  /**
   * A hash of rule name -> active status (true/false).
   * @type {Object<string, boolean>}
   */
  this.ruleActiveStates = {};

  // The key to retrieve user rules from the storage api
  this.USER_RULE_KEY = 'userRules';

  return this;
}


RuleSets.prototype = {

  /**
   * Load packaged rulesets, and rulesets in browser storage
   * @param store object from store.js
   */
  loadFromBrowserStorage: async function(store, applyStoredFunc) {
    this.store = store;
    this.ruleActiveStates = await this.store.get_promise('ruleActiveStates', {});
    try {
      this.wasm_rs = wasm.RuleSets.new();
    } catch(e) {
      util.log(util.WARN, 'Falling back to pure JS implementation: ' + e);
    }
    await applyStoredFunc(this);
    await this.loadStoredUserRules();
    await this.addStoredCustomRulesets();
  },

  /**
   * Convert XML to JS and load rulesets
   * @param {Document} ruleXml
   * @param {string} scope
   */
  addFromXml: function(ruleXml, scope) {
    const rulesets_xml = ruleXml.getElementsByTagName("ruleset");

    let rulesets = [];
    for (let ruleset_xml of rulesets_xml) {
      rulesets.push(this.convertOneXmlToJs(ruleset_xml));
    }

    this.addFromJson(rulesets, scope);
  },

  /**
   * @param {*} ruleJson
   * @param {string} scope
   */
  addFromJson: function(ruleJson, scope) {
    if (this.wasm_rs) {
      this.wasm_rs.add_all_from_js_array(
        ruleJson,
        settings.enableMixedRulesets,
        this.ruleActiveStates,
        scope);
    } else {
      for (let ruleset of ruleJson) {
        try {
          this.parseOneJsonRuleset(ruleset, scope);
        } catch(e) {
          util.log(util.WARN, 'Error processing ruleset:' + e);
        }
      }
    }
  },

  /**
   * Parse one JSON format ruleset element
   * @param {*} ruletag
   * @param {string} scope
   */
  parseOneJsonRuleset: function(ruletag, scope) {
    var default_state = true;
    var note = "";
    var default_off = ruletag["default_off"];
    if (default_off) {
      default_state = false;
      if (default_off === "user rule") {
        default_state = true;
      }
      note += default_off + "\n";
    }

    // If a ruleset declares a platform, and we don't match it, treat it as
    // off-by-default. In practice, this excludes "mixedcontent" rules.
    var platform = ruletag["platform"];
    if (platform) {
      default_state = false;
      if (platform == "mixedcontent" && settings.enableMixedRulesets) {
        default_state = true;
      }
      note += "Platform(s): " + platform + "\n";
    }

    var rule_set = new RuleSet(ruletag["name"], default_state, scope, note.trim());

    // Read user prefs
    if (rule_set.name in this.ruleActiveStates) {
      rule_set.active = this.ruleActiveStates[rule_set.name];
    }

    var rules = ruletag["rule"];
    for (let rule of rules) {
      if (rule["from"] != null && rule["to"] != null) {
        rule_set.rules.push(getRule(rule["from"], rule["to"]));
      }
    }

    var exclusions = ruletag["exclusion"];
    if (exclusions != null) {
      rule_set.exclusions = new RegExp(exclusions.join("|"));
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
   * @param {string} scope
   * @returns {boolean}
   */
  addUserRule : function(params, scope) {
    util.log(util.INFO, 'adding new user rule for ' + JSON.stringify(params));
    if (this.wasm_rs) {
      this.wasm_rs.add_all_from_js_array(
        [params],
        settings.enableMixedRulesets,
        this.ruleActiveStates,
        scope);
    } else {
      this.parseOneJsonRuleset(params, scope);
    }

    // clear cache so new rule take effect immediately
    for (const target of params.target) {
      this.ruleCache.delete(target);
    }

    // TODO: maybe promote this rule?
    util.log(util.INFO, 'done adding rule');
    return true;
  },

  /**
   * Remove a user rule
   * @param params
   * @returns {boolean}
   */
  removeUserRule: function(ruleset, src) {
    /**
     * FIXME: We have to use ruleset.name here because the ruleset itself
     * carries no information on the target it is applying on. This also
     * made it impossible for users to set custom ruleset name.
     */
    util.log(util.INFO, 'removing user rule for ' + JSON.stringify(ruleset));

    // Remove any cache from runtime
    this.ruleCache.delete(ruleset.name);

    if (src === 'popup') {

      if (this.wasm_rs) {
        this.wasm_rs.remove_ruleset(ruleset);
      } else {
        const tmp = this.targets.get(ruleset.name).filter(r => !r.isEquivalentTo(ruleset));
        this.targets.set(ruleset.name, tmp);

        if (this.targets.get(ruleset.name).length == 0) {
          this.targets.delete(ruleset.name);
        }
      }
    }

    if (src === 'options') {
      /**
       * FIXME: There is nothing we can do if the call comes from the
       * option page because isEquivalentTo cannot work reliably.
       * Leave the heavy duties to background.js to call initializeAllRules
       */
    }
    util.log(util.INFO, 'done removing rule');
    return true;
  },

  /**
  * Retrieve stored user rules from storage api
  **/
  getStoredUserRules: async function() {
    return await this.store.get_promise(this.USER_RULE_KEY, []);
  },

  /**
  * Load all stored user rules into this RuleSet object
  */
  loadStoredUserRules: function() {
    return this.getStoredUserRules()
      .then(userRules => {
        this.addFromJson(userRules, '');
        util.log(util.INFO, `loaded ${userRules.length} stored user rules`);
      });
  },

  /**
  * Adds a new user rule
  * @param params: params defining the rule
  * @param cb: Callback to call after success/fail
  * */
  addNewRuleAndStore: async function(params) {
    if (this.addUserRule(params, '')) {
      // If we successfully added the user rule, save it in the storage
      // api so it's automatically applied when the extension is
      // reloaded.
      let userRules = await this.getStoredUserRules();
      // TODO: there's a race condition here, if this code is ever executed from multiple
      // client windows in different event loops.
      userRules.push(params);
      // TODO: can we exceed the max size for storage?
      await this.store.set_promise(this.USER_RULE_KEY, userRules);
    }
  },

  /**
  * Removes a user rule
  * @param ruleset: the ruleset to remove
  * */
  removeRuleAndStore: async function(ruleset, src) {
    if (this.removeUserRule(ruleset, src)) {
      let userRules = await this.getStoredUserRules();

      if (src === 'popup') {
        userRules = userRules.filter(r =>
          !(r.name === ruleset.name && r.rule[0].to === ruleset.rules[0].to)
        );
      }

      if (src === 'options') {
        userRules = userRules.filter(r =>
          !(r.name === ruleset.name && r.rule[0].to === ruleset.rule[0].to)
        );
      }
      await this.store.set_promise(this.USER_RULE_KEY, userRules);
    }
  },

  addStoredCustomRulesets: function() {
    return new Promise(resolve => {
      this.store.get({
        legacy_custom_rulesets: [],
        debugging_rulesets: ""
      }, item => {
        this.loadCustomRulesets(item.legacy_custom_rulesets);
        this.loadCustomRuleset("<root>" + item.debugging_rulesets + "</root>");
        resolve();
      });
    });
  },

  // Load in the legacy custom rulesets, if any
  loadCustomRulesets: function(legacy_custom_rulesets) {
    for(let legacy_custom_ruleset of legacy_custom_rulesets) {
      this.loadCustomRuleset(legacy_custom_ruleset);
    }
  },

  loadCustomRuleset: function(ruleset_string) {
    this.addFromXml((new DOMParser()).parseFromString(ruleset_string, 'text/xml'), '');
  },

  setRuleActiveState: async function(ruleset_name, active) {
    if (active == undefined) {
      delete this.ruleActiveStates[ruleset_name];
    } else {
      this.ruleActiveStates[ruleset_name] = active;
    }
    await this.store.set_promise('ruleActiveStates', this.ruleActiveStates);
  },

  /**
   * Converts an XML ruleset to a JS ruleset for parsing
   * @param ruletag The whole <ruleset> tag to parse
   */
  convertOneXmlToJs: function(ruletag) {
    try {
      let ruleset = {};

      let default_off = ruletag.getAttribute("default_off");
      if (default_off) {
        ruleset["default_off"] = default_off;
      }

      let platform = ruletag.getAttribute("platform");
      if (platform) {
        ruleset["platform"] = platform;
      }

      let name = ruletag.getAttribute("name");
      if (name) {
        ruleset["name"] = name;
      }

      let rules = [];
      for (let rule of ruletag.getElementsByTagName("rule")) {
        rules.push({
          from: rule.getAttribute("from"),
          to: rule.getAttribute("to")
        });
      }
      if (rules.length > 0) {
        ruleset["rule"] = rules;
      }

      let exclusions = [];
      for (let exclusion of ruletag.getElementsByTagName("exclusion")) {
        exclusions.push(exclusion.getAttribute("pattern"));
      }
      if (exclusions.length > 0) {
        ruleset["exclusion"] = exclusions;
      }

      let cookierules = [];
      for (let cookierule of ruletag.getElementsByTagName("securecookie")) {
        cookierules.push({
          host: cookierule.getAttribute("host"),
          name: cookierule.getAttribute("name")
        });
      }
      if (cookierules.length > 0) {
        ruleset["securecookie"] = cookierules;
      }

      let targets = [];
      for (let target of ruletag.getElementsByTagName("target")) {
        targets.push(target.getAttribute("host"));
      }
      if (targets.length > 0) {
        ruleset["target"] = targets;
      }

      return ruleset;
    } catch (e) {
      util.log(util.WARN, 'Error converting ruleset to JS:' + e);
      return {};
    }
  },

  /**
   * Return a list of rulesets that apply to this host
   * @param host The host to check
   * @returns {*} (empty) list
   */
  potentiallyApplicableRulesets: function(host) {
    // Have we cached this result? If so, return it!
    if (this.ruleCache.has(host)) {
      let cached_item = this.ruleCache.get(host);
      util.log(util.DBUG, "Ruleset cache hit for " + host + " items:" + cached_item.size);
      return cached_item;
    } else {
      util.log(util.DBUG, "Ruleset cache miss for " + host);
    }

    let results;
    if (this.wasm_rs) {
      let pa = this.wasm_rs.potentially_applicable(host);
      results = new Set([...pa].map(ruleset => {
        let rs = new RuleSet(ruleset.name, ruleset.default_state, ruleset.scope, ruleset.note);

        if (ruleset.cookierules) {
          let cookierules = ruleset.cookierules.map(cookierule => {
            return new CookieRule(cookierule.host, cookierule.name);
          });
          rs.cookierules = cookierules;
        } else {
          rs.cookierules = null;
        }

        let rules = ruleset.rules.map(rule => {
          return getRule(rule.from, rule.to);
        });
        rs.rules = rules;

        if (ruleset.exclusions) {
          rs.exclusions = new RegExp(ruleset.exclusions);
        } else {
          rs.exclusions = null;
        }

        rs.active = ruleset.active;

        return rs;
      }));
    } else {
      // Let's begin search
      results = (this.targets.has(host) ?
        new Set([...this.targets.get(host)]) :
        new Set());

      let expressions = util.getWildcardExpressions(host);
      for (const expression of expressions) {
        results = (this.targets.has(expression) ?
          new Set([...results, ...this.targets.get(expression)]) :
          results);
      }

      // Clean the results list, which may contain duplicates or undefined entries
      results.delete(undefined);

      util.log(util.DBUG,"Applicable rules for " + host + ":");
      if (results.size == 0) {
        util.log(util.DBUG, "  None");
        results = util.nullIterable;
      } else {
        results.forEach(result => util.log(util.DBUG, "  " + result.name));
      }
    }

    // Insert results into the ruleset cache
    this.ruleCache.set(host, results);

    // Cap the size of the cache. (Limit chosen somewhat arbitrarily)
    if (this.ruleCache.size > 1000) {
      // Map.prototype.keys() returns keys in insertion order, so this is a FIFO.
      this.ruleCache.delete(this.ruleCache.keys().next().value);
    }

    return results;
  },

  /**
   * Check to see if the Cookie object c meets any of our cookierule criteria for being marked as secure.
   * @param cookie The cookie to test
   * @returns {*} true or false
   */
  shouldSecureCookie: function(cookie) {
    let hostname = cookie.domain;
    // cookie domain scopes can start with .
    while (hostname.charAt(0) == ".") {
      hostname = hostname.slice(1);
    }

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

    if (settings.domainBlacklist.has(hostname)) {
      util.log(util.INFO, "cookies for " + hostname + "blacklisted");
      return false;
    }

    // Second, we need a cookie pass two tests before patching it
    //   (1) it is safe to secure the cookie, as per safeToSecureCookie()
    //   (2) it matches with the CookieRule
    //
    // We kept a cache of the results for (1), if we have a cached result which
    //   (a) is false, we should not secure the cookie for sure
    //   (b) is true, we need to perform test (2)
    //
    // Otherwise,
    //   (c) We need to perform (1) and (2) in place

    let safe = false;
    if (this.cookieHostCache.has(hostname)) {
      util.log(util.DBUG, "Cookie host cache hit for " + hostname);
      safe = this.cookieHostCache.get(hostname); // true only if it is case (b)
      if (!safe) {
        return false; // (a)
      }
    } else {
      util.log(util.DBUG, "Cookie host cache miss for " + hostname);
    }

    const potentiallyApplicable = this.potentiallyApplicableRulesets(hostname);
    for (const ruleset of potentiallyApplicable) {
      if (ruleset.cookierules !== null && ruleset.active) {
        // safe is false only indicate the lack of a cached result
        // we cannot use it to avoid looping here
        for (const cookierule of ruleset.cookierules) {
          // if safe is true, it is case (b); otherwise it is case (c)
          if (cookierule.host_c.test(cookie.domain) && cookierule.name_c.test(cookie.name)) {
            return safe || this.safeToSecureCookie(hostname, potentiallyApplicable);
          }
        }
      }
    }
    return false;
  },

  /**
   * Check if it is secure to secure the cookie (=patch the secure flag in).
   * @param domain The domain of the cookie
   * @param potentiallyApplicable
   * @returns {*} true or false
   */
  safeToSecureCookie: function(domain, potentiallyApplicable) {
    // Make up a random URL on the domain, and see if we would HTTPSify that.
    var nonce_path = "/" + Math.random().toString();
    var test_uri = "http://" + domain + nonce_path + nonce_path;

    // Cap the size of the cookie cache (limit chosen somewhat arbitrarily)
    if (this.cookieHostCache.size > 250) {
      // Map.prototype.keys() returns keys in insertion order, so this is a FIFO.
      this.cookieHostCache.delete(this.cookieHostCache.keys().next().value);
    }

    util.log(util.INFO, "Testing securecookie applicability with " + test_uri);
    for (let ruleset of potentiallyApplicable) {
      if (ruleset.active && ruleset.apply(test_uri)) {
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
   * Get a list of simple rules (active, with no exclusions) for all hosts that
   * are in a single ruleset, and end in the specified ending.
   * @param ending Target ending to search for
   * @returns A list of { host, from_regex, to, scope_regex }
   */
  getSimpleRulesEndingWith: function(ending) {
    let results;

    if (this.wasm_rs) {
      results = this.wasm_rs.get_simple_rules_ending_with(ending);
    } else {
      results = [];
      for(let [host, rulesets] of this.targets) {
        if (host.endsWith(ending) &&
            rulesets.length == 1 &&
            rulesets[0].active === true &&
            rulesets[0].exclusions == null
        ) {
          for (let rule of rulesets[0].rules) {
            if (rule.from_c.test("http://" + host + "/")) {
              results.push({ host, from_regex: rule.from_c.toString(), to: rule.to, scope_regex: rulesets[0].scope.toString() });
            }
          }
        }
      }
    }
    return results;
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
  trivial_rule,
  Rule,
  RuleSet,
  RuleSets,
  getRule
});

})(typeof exports == 'undefined' ? require.scopes.rules = {} : exports);
