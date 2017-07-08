'use strict'
;(function () {
  // To reduce memory usage for the numerous rules/cookies with trivial rules
  const trivialRuleTo = 'https:'
  const trivialRuleFromC = new RegExp('^http:')
  const trivialCookieNameC = new RegExp('.*')
  const trivialCookieHostC = new RegExp('.*')

  /**
   * A single rule
   * @param from
   * @param to
   * @constructor
   */
  class Rule {
    constructor (from, to) {
      if (from === '^http:' && to === 'https:') {
        // This is a trivial rule, rewriting http->https with no complex RegExp.
        this.to = trivialRuleTo
        this.fromC = trivialRuleFromC
      } else {
        // This is a non-trivial rule.
        this.to = to
        this.fromC = new RegExp(from)
      }
    }
  }

  /**
   * Regex-Compile a pattern
   * @param pattern The pattern to compile
   * @constructor
   */
  class Exclusion {
    constructor (pattern) {
      this.patternC = new RegExp(pattern)
    }
  }

  /**
   * Generates a CookieRule
   * @param host The host regex to compile
   * @param cookieName The cookie name Regex to compile
   * @constructor
   */
  class CookieRule {
    constructor (host, cookieName) {
      if (host === '.*' || host === '.+' || host === '.') {
        // Some cookie rules trivially match any host.
        this.hostC = trivialCookieHostC
      } else {
        this.hostC = new RegExp(host)
      }

      if (cookieName === '.*' || cookieName === '.+' || cookieName === '.') {
        // About 50% of cookie rules trivially match any name.
        this.nameC = trivialCookieNameC
      } else {
        this.nameC = new RegExp(cookieName)
      }
    }
  }

  /**
   *A collection of rules
   * @param setName The name of this set
   * @param defaultState activity state
   * @param note Note will be displayed in popup
   * @constructor
   */
  class RuleSet {
    constructor (setName, defaultState, note) {
      this.name = setName
      this.rules = []
      this.exclusions = null
      this.cookierules = null
      this.active = defaultState
      this.defaultState = defaultState
      this.note = note
    }

    /**
     * Check if a URI can be rewritten and rewrite it
     * @param urispec The uri to rewrite
     * @returns {*} null or the rewritten uri
     */
    apply (urispec) {
      let returl = null
      // If we're covered by an exclusion, go home
      if (this.exclusions !== null) {
        for (let i = 0; i < this.exclusions.length; i++) {
          if (this.exclusions[i].patternC.test(urispec)) {
            window.log(window.DBUG, 'excluded uri ' + urispec)
            return null
          }
        }
      }

      // Okay, now find the first rule that triggers
      for (let i = 0; i < this.rules.length; i++) {
        returl = urispec.replace(this.rules[i].fromC,
          this.rules[i].to)
        if (returl !== urispec) {
          return returl
        }
      }
      return null
    }

    /**
     * Deep equivalence comparison
     * @param ruleset The ruleset to compare with
     * @returns true or false, depending on whether it's deeply equivalent
     */
    isEquivalentTo (ruleset) {
      if (this.name !== ruleset.name ||
         this.note !== ruleset.note ||
         this.state !== ruleset.state ||
         this.defaultState !== ruleset.defaultState) {
        return false
      }

      let thisExclusionsLength
      try {
        thisExclusionsLength = this.exclusions.length
      } catch (e) {
        thisExclusionsLength = 0
      }

      let rulesetExclusionsLength
      try {
        rulesetExclusionsLength = ruleset.exclusions.length
      } catch (e) {
        rulesetExclusionsLength = 0
      }

      let thisRulesLength
      try {
        thisRulesLength = this.rules.length
      } catch (e) {
        thisRulesLength = 0
      }

      let rulesetRulesLength
      try {
        rulesetRulesLength = ruleset.rules.length
      } catch (e) {
        rulesetRulesLength = 0
      }

      if (thisExclusionsLength !== rulesetExclusionsLength ||
         thisRulesLength !== rulesetRulesLength) {
        return false
      }
      if (thisExclusionsLength > 0) {
        for (let i = 0; i < this.exclusions.length; i++) {
          if (this.exclusions[i].patternC !== ruleset.exclusions[i].patternC) {
            return false
          }
        }
      }
      if (thisRulesLength > 0) {
        for (let i = 0; i < this.rules.length; i++) {
          if (this.rules[i].to !== ruleset.rules[i].to) {
            return false
          }
        }
      }
      return true
    }
  }

  /**
   * Initialize Rule Sets
   * @param ruleActiveStates default state for rules
   * @constructor
   */
  class RuleSets {
    constructor (ruleActiveStates) {
      // Load rules into structure
      this.targets = {}

      // A cache for potentiallyApplicableRulesets
      this.ruleCache = new Map()

      // A cache for cookie hostnames.
      this.cookieHostCache = new Map()

      // A hash of rule name -> active status (true/false).
      this.ruleActiveStates = ruleActiveStates
    }

    /**
     * Iterate through data XML and load rulesets
     */
    addFromXml (ruleXml) {
      const sets = ruleXml.getElementsByTagName('ruleset')
      for (let i = 0; i < sets.length; i++) {
        try {
          this.parseOneRuleset(sets[i])
        } catch (e) {
          window.log(window.WARN, 'Error processing ruleset:' + e)
        }
      }
    }

    /**
     * Load a user rule
     * @param params
     * @returns {boolean}
     */
    addUserRule (params) {
      window.log(window.INFO, 'adding new user rule for ' + JSON.stringify(params))
      const newRuleSet = new RuleSet(params.host, true, 'user rule')
      const newRule = new Rule(params.urlMatcher, params.redirectTo)
      newRuleSet.rules.push(newRule)
      if (!(params.host in this.targets)) {
        this.targets[params.host] = []
      }
      this.ruleCache.delete(params.host)
      // TODO: maybe promote this rule?
      this.targets[params.host].push(newRuleSet)
      if (newRuleSet.name in this.ruleActiveStates) {
        newRuleSet.active = (this.ruleActiveStates[newRuleSet.name] === true)
      }
      window.log(window.INFO, 'done adding rule')
    }

    /**
     * Remove a user rule
     * @param params
     * @returns {boolean}
     */
    removeUserRule (ruleset) {
      window.log(window.INFO, 'removing user rule for ' + JSON.stringify(ruleset))
      this.ruleCache.delete(ruleset.name)
      for (let i = 0; i < this.targets[ruleset.name].length; i++) {
        if (this.targets[ruleset.name][i].isEquivalentTo(ruleset)) {
          this.targets[ruleset.name].splice(i, 1)
        }
      }
      if (this.targets[ruleset.name].length === 0) {
        delete this.targets[ruleset.name]
      }
      window.log(window.INFO, 'done removing rule')
    }

    /**
     * Does the loading of a ruleset.
     * @param ruletag The whole <ruleset> tag to parse
     */
    parseOneRuleset (ruletag) {
      let defaultState = true
      let note = ''
      const defaultOff = ruletag.getAttribute('default_off')
      if (defaultOff) {
        defaultState = false
        note += defaultOff + '\n'
      }

      // If a ruleset declares a platform, and we don't match it, treat it as
      // off-by-default. In practice, this excludes "mixedcontent" & "cacert" rules.
      const platform = ruletag.getAttribute('platform')
      if (platform) {
        defaultState = false
        if (platform === 'mixedcontent' && window.enableMixedRulesets) {
          defaultState = true
        }
        note += 'Platform(s): ' + platform + '\n'
      }

      const ruleSet = new RuleSet(ruletag.getAttribute('name'),
        defaultState,
        note.trim())

      // Read user prefs
      if (ruleSet.name in this.ruleActiveStates) {
        ruleSet.active = (this.ruleActiveStates[ruleSet.name] === true)
      }

      const rules = ruletag.getElementsByTagName('rule')
      for (let i = 0; i < rules.length; i++) {
        ruleSet.rules.push(new Rule(rules[i].getAttribute('from'),
          rules[i].getAttribute('to')))
      }

      const exclusions = ruletag.getElementsByTagName('exclusion')
      if (exclusions.length > 0) {
        ruleSet.exclusions = []
        for (let i = 0; i < exclusions.length; i++) {
          ruleSet.exclusions.push(
            new Exclusion(exclusions[i].getAttribute('pattern')))
        }
      }

      const cookierules = ruletag.getElementsByTagName('securecookie')
      if (cookierules.length > 0) {
        ruleSet.cookierules = []
        for (let i = 0; i < cookierules.length; i++) {
          ruleSet.cookierules.push(
            new CookieRule(cookierules[i].getAttribute('host'),
              cookierules[i].getAttribute('name')))
        }
      }

      const targets = ruletag.getElementsByTagName('target')
      for (let i = 0; i < targets.length; i++) {
        const host = targets[i].getAttribute('host')
        if (!(host in this.targets)) {
          this.targets[host] = []
        }
        this.targets[host].push(ruleSet)
      }
    }

    /**
     * Return a list of rulesets that apply to this host
     * @param host The host to check
     * @returns {*} (empty) list
     */
    potentiallyApplicableRulesets (host) {
      // Have we cached this result? If so, return it!
      const cachedItem = this.ruleCache.get(host)
      if (cachedItem !== undefined) {
        window.log(window.DBUG, 'Ruleset cache hit for ' + host + ' items:' + cachedItem.length)
        return cachedItem
      }
      window.log(window.DBUG, 'Ruleset cache miss for ' + host)

      let tmp
      let results = []
      if (this.targets[host]) {
        // Copy the host targets so we don't modify them.
        results = results.concat(this.targets[host])
      }

      // Ensure host is well-formed (RFC 1035)
      if (host.indexOf('..') !== -1 || host.length > 255) {
        window.log(window.WARN, 'Malformed host passed to potentiallyApplicableRulesets: ' + host)
        return null
      }

      // Replace each portion of the domain with a * in turn
      const segmented = host.split('.')
      for (let i = 0; i < segmented.length; i++) {
        tmp = segmented[i]
        segmented[i] = '*'
        results = results.concat(this.targets[segmented.join('.')])
        segmented[i] = tmp
      }
      // now eat away from the left, with *, so that for x.y.z.google.com we
      // check *.z.google.com and *.google.com (we did *.y.z.google.com above)
      for (let i = 2; i <= segmented.length - 2; i++) {
        const t = '*.' + segmented.slice(i, segmented.length).join('.')
        results = results.concat(this.targets[t])
      }

      // Clean the results list, which may contain duplicates or undefined entries
      const resultSet = new Set(results)
      resultSet.delete(undefined)

      window.log(window.DBUG, 'Applicable rules for ' + host + ':')
      if (resultSet.size === 0) {
        window.log(window.DBUG, '  None')
      } else {
        for (const target of resultSet.values()) {
          window.log(window.DBUG, '  ' + target.name)
        }
      }

      // Insert results into the ruleset cache
      this.ruleCache.set(host, resultSet)

      // Cap the size of the cache. (Limit chosen somewhat arbitrarily)
      if (this.ruleCache.size > 1000) {
        // Map.prototype.keys() returns keys in insertion order, so this is a FIFO.
        this.ruleCache.delete(this.ruleCache.keys().next().value)
      }

      return resultSet
    }

    /**
     * Check to see if the Cookie object c meets any of our cookierule criteria for being marked as secure.
     * @param cookie The cookie to test
     * @returns {*} ruleset or null
     */
    shouldSecureCookie (cookie) {
      let hostname = cookie.domain
      // cookie domain scopes can start with .
      while (hostname.charAt(0) === '.') {
        hostname = hostname.slice(1)
      }

      if (!this.safeToSecureCookie(hostname)) {
        return null
      }

      const potentiallyApplicable = this.potentiallyApplicableRulesets(hostname)
      for (const ruleset of potentiallyApplicable) {
        if (ruleset.cookierules !== null && ruleset.active) {
          for (let i = 0; i < ruleset.cookierules.length; i++) {
            const cr = ruleset.cookierules[i]
            if (cr.hostC.test(cookie.domain) && cr.nameC.test(cookie.name)) {
              return ruleset
            }
          }
        }
      }
      return null
    }

    /**
     * Check if it is secure to secure the cookie (=patch the secure flag in).
     * @param domain The domain of the cookie
     * @returns {*} true or false
     */
    safeToSecureCookie (domain) {
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

      if (window.domainBlacklist.has(domain)) {
        window.log(window.INFO, 'cookies for ' + domain + 'blacklisted')
        return false
      }
      const cachedItem = this.cookieHostCache.get(domain)
      if (cachedItem !== undefined) {
        window.log(window.DBUG, 'Cookie host cache hit for ' + domain)
        return cachedItem
      }
      window.log(window.DBUG, 'Cookie host cache miss for ' + domain)

      // If we passed that test, make up a random URL on the domain, and see if
      // we would HTTPSify that.

      const noncePath = '/' + Math.random().toString()
      const testUri = 'http://' + domain + noncePath + noncePath

      // Cap the size of the cookie cache (limit chosen somewhat arbitrarily)
      if (this.cookieHostCache.size > 250) {
        // Map.prototype.keys() returns keys in insertion order, so this is a FIFO.
        this.cookieHostCache.delete(this.cookieHostCache.keys().next().value)
      }

      window.log(window.INFO, 'Testing securecookie applicability with ' + testUri)
      const potentiallyApplicable = this.potentiallyApplicableRulesets(domain)
      const secure = potentiallyApplicable.some(ruleset => ruleset.active && ruleset.apply(testUri))

      if (secure) {
        window.log(window.INFO, 'Cookie domain could be secured.')
      } else {
        window.log(window.INFO, 'Cookie domain could NOT be secured.')
       }

      this.cookieHostCache.set(domain, secure)
      return secure
    }

    /**
     * Rewrite an URI
     * @param urispec The uri to rewrite
     * @param host The host of this uri
     * @returns {*} the new uri or null
     */
    rewriteURI (urispec, host) {
      const potentiallyApplicable = this.potentiallyApplicableRulesets(host)
      const ruleset = potentiallyApplicable.find(ruleset => ruleset.active)

      return ruleset ? ruleset.apply(urispec) : null
    }
  }

  if (typeof window !== 'undefined') {
    window.RuleSets = RuleSets
  }

  // Export for HTTPS Rewriter if applicable.
  if (typeof exports !== 'undefined') {
    exports.RuleSets = RuleSets
  }
})()
