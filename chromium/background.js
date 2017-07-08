'use strict'
;(function () {
  /**
   * Fetch and parse XML to be loaded as RuleSets.
   *
   * @param url: a relative URL to local XML
   */
  function loadExtensionFile (url, returnType) {
    const xhr = new XMLHttpRequest()
    // Use blocking XHR to ensure everything is loaded by the time
    // we return.
    xhr.open('GET', chrome.extension.getURL(url), false)
    xhr.send(null)
    // Get file contents
    if (xhr.readyState !== 4) {
      return null
    }
    if (returnType === 'xml') {
      return xhr.responseXML
    }
    return xhr.responseText
  }

  // Rules are loaded here
  const RuleSets = window.RuleSets

  window.allRules = new RuleSets(localStorage)

  // Allow users to enable `platform="mixedcontent"` rulesets
  window.enableMixedRulesets = false
  window.storage.get({enableMixedRulesets: false}, function (item) {
    window.enableMixedRulesets = item.enableMixedRulesets
    window.allRules.addFromXml(loadExtensionFile('rules/default.rulesets', 'xml'))
  })

  window.USER_RULE_KEY = 'userRules'
  // Records which tabId's are active in the HTTPS Switch Planner (see
  // devtools-panel.js).
  window.switchPlannerEnabledFor = {}
  // Detailed information recorded when the HTTPS Switch Planner is active.
  // Structure is:
  //   switchPlannerInfo[tabId]["rw"/"nrw"][resourceHost][activeContent][url];
  // rw / nrw stand for "rewritten" versus "not rewritten"
  window.switchPlannerInfo = {}

  // Is HTTPSe enabled, or has it been manually disabled by the user?
  window.isExtensionEnabled = true

  // Load prefs about whether http nowhere is on. Structure is:
  //  { httpNowhere: true/false }
  let httpNowhereOn = false
  window.storage.get({httpNowhere: false}, function (item) {
    httpNowhereOn = item.httpNowhere
    window.updateState()
  })
  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === 'sync' || areaName === 'local') {
      for (const key of changes.keys) {
        if (key === 'httpNowhere') {
          httpNowhereOn = changes[key].newValue
          window.updateState()
        }
      }
    }
  })
  chrome.tabs.onActivated.addListener(function () {
    window.updateState()
  })
  chrome.windows.onFocusChanged.addListener(function () {
    window.updateState()
  })
  chrome.webNavigation.onCompleted.addListener(function () {
    window.updateState()
  })

  /**
  * Load stored user rules
   **/
  const getStoredUserRules = function () {
    const oldUserRuleString = localStorage.getItem(window.USER_RULE_KEY)
    let oldUserRules = []
    if (oldUserRuleString) {
      oldUserRules = JSON.parse(oldUserRuleString)
    }
    return oldUserRules
  }
  const wr = chrome.webRequest

  /**
   * Load all stored user rules
   */
  const loadStoredUserRules = function () {
    const rules = getStoredUserRules()
    for (let i = 0; i < rules.length; i++) {
      window.allRules.addUserRule(rules[i])
    }
    window.log('INFO', 'loaded ' + rules.length + ' stored user rules')
  }

  loadStoredUserRules()

  /**
   * Set the icon color correctly
   * inactive: extension is enabled, but no rules were triggered on this page.
   * blocking: extension is in "block all HTTP requests" mode.
   * active: extension is enabled and rewrote URLs on this page.
   * disabled: extension is disabled from the popup menu.
   */
  window.updateState = function () {
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
      if (!tabs || tabs.length === 0) {
        return
      }
      const applied = window.activeRulesets.getRulesets(tabs[0].id)
      let iconState = 'inactive'
      if (!window.isExtensionEnabled) {
        iconState = 'disabled'
      } else if (httpNowhereOn) {
        iconState = 'blocking'
      } else if (applied) {
        iconState = 'active'
      }
      chrome.browserAction.setIcon({
        path: {
          '38': 'icons/icon-' + iconState + '-38.png'
        }
      })
      chrome.browserAction.setTitle({
        title: 'HTTPS Everywhere (' + iconState + ')'
      })
    })
  }

  /**
   * Adds a new user rule
   * @param params: params defining the rule
   * @param cb: Callback to call after success/fail
   * */
  window.addNewRule = function (params) {
    window.allRules.addUserRule(params)
    // If we successfully added the user rule, save it in local 
    // storage so it's automatically applied when the extension is 
    // reloaded.
    const oldUserRules = getStoredUserRules()
    // TODO: there's a race condition here, if this code is ever executed from multiple 
    // client windows in different event loops.
    oldUserRules.push(params)
    // TODO: can we exceed the max size for storage?
    localStorage.setItem(window.USER_RULE_KEY, JSON.stringify(oldUserRules))
  }

  /**
   * Removes a user rule
   * @param ruleset: the ruleset to remove
   * */
  window.removeRule = function (ruleset) {
    window.allRules.removeUserRule(ruleset)
    // If we successfully removed the user rule, remove it in local storage too
    const oldUserRules = getStoredUserRules()
    for (let i = 0; i < oldUserRules.length; i++) {
      if (oldUserRules[i].host === ruleset.name &&
          oldUserRules[i].redirectTo === ruleset.rules[0].to &&
          String(RegExp(oldUserRules[i].urlMatcher)) === String(ruleset.rules[0].fromC)) {
        oldUserRules.splice(i, 1)
        break
      }
    }
    localStorage.setItem(window.USER_RULE_KEY, JSON.stringify(oldUserRules))
  }

  /**
   * Adds a listener for removed tabs
   * */
  class AppliedRulesets {
    constructor () {
      this.activeTabRules = {}

      const that = this
      chrome.tabs.onRemoved.addListener(function (tabId, info) {
        that.removeTab(tabId)
      })
    }

    addRulesetToTab (tabId, ruleset) {
      if (tabId in this.activeTabRules) {
        this.activeTabRules[tabId][ruleset.name] = ruleset
      } else {
        this.activeTabRules[tabId] = {}
        this.activeTabRules[tabId][ruleset.name] = ruleset
      }
    }

    getRulesets (tabId) {
      if (tabId in this.activeTabRules) {
        return this.activeTabRules[tabId]
      }
      return null
    }

    removeTab (tabId) {
      delete this.activeTabRules[tabId]
    }
  }

  // FIXME: change this name
  window.activeRulesets = new AppliedRulesets()

  window.urlBlacklist = new Set()
  window.domainBlacklist = new Set()

  // redirect counter workaround
  // TODO: Remove this code if they ever give us a real counter
  const redirectCounter = {}

  /**
   * Called before a HTTP(s) request. Does the heavy lifting
   * Cancels the request/redirects it to HTTPS. URL modification happens in here.
   * @param details of the handler, see Chrome doc
   * */
  function onBeforeRequest (details) {
    // If HTTPSe has been disabled by the user, return immediately.
    if (!window.isExtensionEnabled) {
      return {}
    }

    const uri = document.createElement('a')
    uri.href = details.url

    // Should the request be canceled?
    const shouldCancel = (
      httpNowhereOn &&
      uri.protocol === 'http:' &&
      !/\.onion$/.test(uri.hostname) &&
      !/^localhost$/.test(uri.hostname) &&
      !/^127(\.[0-9]{1,3}){3}$/.test(uri.hostname) &&
      !/^0\.0\.0\.0$/.test(uri.hostname)
    )

    // Normalise hosts such as "www.example.com."

    let canonicalHost = uri.hostname

    while (canonicalHost.charAt(canonicalHost.length - 1) === '.') {
      canonicalHost = canonicalHost.slice(0, -1)
    }

    uri.hostname = canonicalHost

    // If there is a username / password, put them aside during the ruleset
    // analysis process
    let usingCredentialsInUrl = false
    let tmpUser
    let tmpPass
    if (uri.password || uri.username) {
      usingCredentialsInUrl = true
      tmpUser = uri.username
      tmpPass = uri.password
      uri.username = null
      uri.password = null
    }

    const canonicalUrl = uri.href
    if (details.url !== canonicalUrl && !usingCredentialsInUrl) {
      window.log(window.INFO, 'Original url ' + details.url +
          ' changed before processing to ' + canonicalUrl)
    }
    if (window.urlBlacklist.has(canonicalUrl)) {
      return {cancel: shouldCancel}
    }

    if (details.type === 'main_frame') {
      window.activeRulesets.removeTab(details.tabId)
    }

    const potentiallyApplicable = window.allRules.potentiallyApplicableRulesets(uri.hostname)

    if (redirectCounter[details.requestId] >= 8) {
      window.log(window.NOTE, 'Redirect counter hit for ' + canonicalUrl)
      window.urlBlacklist.add(canonicalUrl)
      const hostname = uri.hostname
      window.domainBlacklist.add(hostname)
      window.log(window.WARN, 'Domain blacklisted ' + hostname)
      return {cancel: shouldCancel}
    }

    let newuristr = null

    for (const ruleset of potentiallyApplicable) {
      window.activeRulesets.addRulesetToTab(details.tabId, ruleset)
      if (ruleset.active && !newuristr) {
        newuristr = ruleset.apply(canonicalUrl)
      }
    }

    if (newuristr && usingCredentialsInUrl) {
      // re-insert userpass info which was stripped temporarily
      const uriWithCredentials = document.createElement('a')
      uriWithCredentials.href = newuristr
      uriWithCredentials.username = tmpUser
      uriWithCredentials.password = tmpPass
      newuristr = uriWithCredentials.href
    }

    // In Switch Planner Mode, record any non-rewriteable
    // HTTP URIs by parent hostname, along with the resource type.
    if (window.switchPlannerEnabledFor[details.tabId] && uri.protocol !== 'https:') {
      writeToSwitchPlanner(details.type,
        details.tabId,
        canonicalHost,
        details.url,
        newuristr)
    }

    if (httpNowhereOn) {
      // If loading a main frame, try the HTTPS version as an alternative to
      // failing.
      if (shouldCancel) {
        if (!newuristr) {
          return {redirectUrl: canonicalUrl.replace(/^http:/, 'https:')}
        } else {
          return {redirectUrl: newuristr.replace(/^http:/, 'https:')}
        }
      }
      if (newuristr && newuristr.substring(0, 5) === 'http:') {
        // Abort early if we're about to redirect to HTTP in HTTP Nowhere mode
        return {cancel: true}
      }
    }

    if (newuristr) {
      return {redirectUrl: newuristr}
    } else {
      return {cancel: shouldCancel}
    }
  }

  // Map of which values for the `type' enum denote active vs passive content.
  // https://developer.chrome.com/extensions/webRequest.html#event-onBeforeRequest
  const activeTypes = { stylesheet: 1, script: 1, object: 1, other: 1 }

  // We consider sub_frame to be passive even though it can contain JS or flash.
  // This is because code running in the sub_frame cannot access the main frame's
  // content, by same-origin policy. This is true even if the sub_frame is on the
  // same domain but different protocol - i.e. HTTP while the parent is HTTPS -
  // because same-origin policy includes the protocol. This also mimics Chrome's
  // UI treatment of insecure subframes.
  const passiveTypes = { main_frame: 1, sub_frame: 1, image: 1, xmlhttprequest: 1 }

  /**
   * Record a non-HTTPS URL loaded by a given hostname in the Switch Planner, for
   * use in determining which resources need to be ported to HTTPS.
   * (Reminder: Switch planner is the pro-tool enabled by switching into debug-mode)
   *
   * @param type: type of the resource (see activeTypes and passiveTypes arrays)
   * @param tabId: The id of the tab
   * @param resourceHost: The host of the original url
   * @param resourceUrl: the original url
   * @param rewrittenUrl: The url rewritten to
   * */
  function writeToSwitchPlanner (type, tabId, resourceHost, resourceUrl, rewrittenUrl) {
    let rw = 'rw'
    if (rewrittenUrl == null) { rw = 'nrw' }

    let activeContent = 0
    if (activeTypes[type]) {
      activeContent = 1
    } else if (passiveTypes[type]) {
      activeContent = 0
    } else {
      window.log(window.WARN, 'Unknown type from onBeforeRequest details: `' + type + "', assuming active")
      activeContent = 1
    }

    if (!window.switchPlannerInfo[tabId]) {
      window.switchPlannerInfo[tabId] = {}
      window.switchPlannerInfo[tabId]['rw'] = {}
      window.switchPlannerInfo[tabId]['nrw'] = {}
    }
    if (!window.switchPlannerInfo[tabId][rw][resourceHost]) { window.switchPlannerInfo[tabId][rw][resourceHost] = {} }
    if (!window.switchPlannerInfo[tabId][rw][resourceHost][activeContent]) { window.switchPlannerInfo[tabId][rw][resourceHost][activeContent] = {} }

    window.switchPlannerInfo[tabId][rw][resourceHost][activeContent][resourceUrl] = 1
  }

  /**
   * Return the number of properties in an object. For associative maps, this is
   * their size.
   * @param obj: object to calc the size for
   * */
  function objSize (obj) {
    if (typeof obj === 'undefined') return 0
    let size = 0
    for (const key of obj.keys) {
      if (obj.hasOwnProperty(key)) size++
    }
    return size
  }

  /**
   * Make an array of asset hosts by score so we can sort them,
   * presenting the most important ones first.
   * */
  function sortSwitchPlanner (tabId, rewritten) {
    const assetHostList = []
    if (typeof window.switchPlannerInfo[tabId] === 'undefined' ||
        typeof window.switchPlannerInfo[tabId][rewritten] === 'undefined') {
      return []
    }
    const tabInfo = window.switchPlannerInfo[tabId][rewritten]
    for (const assetHost of tabInfo.keys) {
      const ah = tabInfo[assetHost]
      const activeCount = objSize(ah[1])
      const passiveCount = objSize(ah[0])
      const score = activeCount * 100 + passiveCount
      assetHostList.push([score, activeCount, passiveCount, assetHost])
    }
    assetHostList.sort(function (a, b) { return a[0] - b[0] })
    return assetHostList
  }

  /**
  * Format the switch planner output for presentation to a user.
  * */
  function switchPlannerSmallHtmlSection (tabId, rewritten) {
    const assetHostList = sortSwitchPlanner(tabId, rewritten)
    if (assetHostList.length === 0) {
      return '<b>none</b>'
    }

    let output = ''
    for (let i = 0; i < assetHostList.length; i++) {
      const host = assetHostList[i][3]
      const activeCount = assetHostList[i][1]
      const passiveCount = assetHostList[i][2]

      output += '<b>' + host + '</b>: '
      if (activeCount > 0) {
        output += activeCount + ' active'
        if (passiveCount > 0) { output += ', ' }
      }
      if (passiveCount > 0) {
        output += passiveCount + ' passive'
      }
      output += '<br/>'
    }
    return output
  }

  /**
   * Create switch planner sections
   * */
  function switchPlannerRenderSections (tabId, f) {
    return 'Unrewritten HTTP resources loaded from this tab (enable HTTPS on ' +
           'these domains and add them to HTTPS Everywhere):<br/>' +
           f(tabId, 'nrw') +
           '<br/>Resources rewritten successfully from this tab (update these ' +
           'in your source code):<br/>' +
           f(tabId, 'rw')
  }

  /**
   * Generate the small switch planner html content
   * */
  function switchPlannerSmallHtml (tabId) {
    return switchPlannerRenderSections(tabId, switchPlannerSmallHtmlSection)
  }

  /**
   * Generate a HTML link from urls in map
   * map: the map containing the urls
   * */
  function linksFromKeys (map) {
    if (typeof map === 'undefined') return ''
    let output = ''
    for (const key of map.keys) {
      if (map.hasOwnProperty(key)) {
        output += "<a href='" + key + "'>" + key + '</a><br/>'
      }
    }
    return output
  }

  /**
   * Generate the detailed html fot the switch planner
   * */
  window.switchPlannerDetailsHtml = function (tabId) {
    return switchPlannerRenderSections(tabId, switchPlannerDetailsHtmlSection)
  }

  /**
   * Generate the detailed html fot the switch planner, by section
   * */
  function switchPlannerDetailsHtmlSection (tabId, rewritten) {
    const assetHostList = sortSwitchPlanner(tabId, rewritten)
    let output = ''

    for (let i = 0; i < assetHostList.length; i++) {
      const host = assetHostList[i][3]
      const activeCount = assetHostList[i][1]
      const passiveCount = assetHostList[i][2]

      output += '<b>' + host + '</b>: '
      if (activeCount > 0) {
        output += activeCount + ' active<br/>'
        output += linksFromKeys(window.switchPlannerInfo[tabId][rewritten][host][1])
      }
      if (passiveCount > 0) {
        output += '<br/>' + passiveCount + ' passive<br/>'
        output += linksFromKeys(window.switchPlannerInfo[tabId][rewritten][host][0])
      }
      output += '<br/>'
    }
    return output
  }

  /**
   * monitor cookie changes. Automatically convert them to secure cookies
   * @param changeInfo Cookie changed info, see Chrome doc
   * */
  function onCookieChanged (changeInfo) {
    if (!changeInfo.removed && !changeInfo.cookie.secure && window.isExtensionEnabled) {
      if (window.allRules.shouldSecureCookie(changeInfo.cookie)) {
        const cookie = {name: changeInfo.cookie.name,
          value: changeInfo.cookie.value,
          path: changeInfo.cookie.path,
          httpOnly: changeInfo.cookie.httpOnly,
          expirationDate: changeInfo.cookie.expirationDate,
          storeId: changeInfo.cookie.storeId,
          secure: true}

        // Host-only cookies don't set the domain field.
        if (!changeInfo.cookie.hostOnly) {
          cookie.domain = changeInfo.cookie.domain
        }

        // The cookie API is magical -- we must recreate the URL from the domain and path.
        if (changeInfo.cookie.domain[0] === '.') {
          cookie.url = 'https://www' + changeInfo.cookie.domain + cookie.path
        } else {
          cookie.url = 'https://' + changeInfo.cookie.domain + cookie.path
        }
        // We get repeated events for some cookies because sites change their
        // value repeatedly and remove the "secure" flag.
        window.log(window.DBUG,
          'Securing cookie ' + cookie.name + ' for ' + changeInfo.cookie.domain + ', was secure=' + changeInfo.cookie.secure)
        chrome.cookies.set(cookie)
      }
    }
  }

  /**
   * handling redirects, breaking loops
   * @param details details for the redirect (see chrome doc)
   * */
  function onBeforeRedirect (details) {
    // Catch redirect loops (ignoring about:blank, etc. caused by other extensions)
    const prefix = details.redirectUrl.substring(0, 5)
    if (prefix === 'http:' || prefix === 'https') {
      if (details.requestId in redirectCounter) {
        redirectCounter[details.requestId] += 1
        window.log(window.DBUG, 'Got redirect id ' + details.requestId +
                  ': ' + redirectCounter[details.requestId])
      } else {
        redirectCounter[details.requestId] = 1
      }
    }
  }

  // Registers the handler for requests
  // See: https://github.com/EFForg/https-everywhere/issues/10039
  wr.onBeforeRequest.addListener(onBeforeRequest, {urls: ['<all_urls>']}, ['blocking'])

  // Try to catch redirect loops on URLs we've redirected to HTTPS.
  wr.onBeforeRedirect.addListener(onBeforeRedirect, {urls: ['https://*/*']})

  // Listen for cookies set/updated and secure them if applicable. This function is async/nonblocking.
  chrome.cookies.onChanged.addListener(onCookieChanged)

  /**
   * disable switch Planner
   * @param tabId the Tab to disable for
   */
  function disableSwitchPlannerFor (tabId) {
    delete window.switchPlannerEnabledFor[tabId]
    // Clear stored URL info.
    delete window.switchPlannerInfo[tabId]
  }

  /**
   * Enable switch planner for specific tab
   * @param tabId the tab to enable it for
   */
  function enableSwitchPlannerFor (tabId) {
    window.switchPlannerEnabledFor[tabId] = true
  }

  // Listen for connection from the DevTools panel so we can set up communication.
  chrome.runtime.onConnect.addListener(function (port) {
    if (port.name === 'devtools-page') {
      chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        const tabId = message.tabId

        const disableOnCloseCallback = function (port) {
          window.log(window.DBUG, 'Devtools window for tab ' + tabId + ' closed, clearing data.')
          disableSwitchPlannerFor(tabId)
        }

        if (message.type === 'enable') {
          enableSwitchPlannerFor(tabId)
          port.onDisconnect.addListener(disableOnCloseCallback)
        } else if (message.type === 'disable') {
          disableSwitchPlannerFor(tabId)
        } else if (message.type === 'getSmallHtml') {
          sendResponse({html: switchPlannerSmallHtml(tabId)})
        }
      })
    }
  })
})()
