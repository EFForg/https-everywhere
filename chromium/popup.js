'use strict'

/**
 * Handles rule (de)activation in the popup
 * @param checkbox checkbox being clicked
 * @param ruleset the ruleset tied tot he checkbox
 */
function setRulesetActive (ruleset, tabId, active) {
  const rulesetData = {
    active,
    name: ruleset.name,
    tab_id: tabId
  }

  sendMessage('set_ruleset_active_status', rulesetData).then(() => {
    if (active !== ruleset.default_state) {
      localStorage[ruleset.name] = active
    } else {
      delete localStorage[ruleset.name]

      // Purge the name from the cache so that this unchecking is persistent.
      sendMessage('delete_from_ruleset_cache', ruleset.name)
    }

    // Now reload the selected tab of the current window.
    chrome.tabs.reload()
  })
}

const hostReg = /.*\/\/[^$/]*\//

/**
 * Creates a rule line (including checkbox and icon) for the popup
 * @param ruleset the ruleset to build the line for
 * @returns {*}
 */
function appendRuleLineToListDiv (ruleset, tabId, listDiv) {
  // parent block for line
  const line = document.createElement('div')
  line.className = 'rule checkbox'

  // label 'container'
  const label = document.createElement('label')

  // checkbox
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = ruleset.active

  checkbox.addEventListener('change', () => {
    setRulesetActive(ruleset, tabId, checkbox.checked)
  })

  label.appendChild(checkbox)

  if (navigator.userAgent.match('Chrome')) {
    // favicon (from chrome's cache)
    const favicon = document.createElement('img')
    favicon.className = 'favicon'

    for (const rule of ruleset.rules) {
      const host = hostReg.exec(rule.to)[0]
      if (host) {
        favicon.src = 'chrome://favicon/' + host
        break
      }
    }

    label.appendChild(favicon)
  }

  // label text
  const text = document.createElement('span')
  text.innerText = ruleset.name

  if (ruleset.note.length) {
    text.title = ruleset.note
  }

  if (ruleset.note === 'user rule') {
    const remove = document.createElement('img')
    remove.src = chrome.extension.getURL('remove.png')
    remove.className = 'remove'
    line.appendChild(remove)

    remove.addEventListener('click', function () {
      sendMessage('remove_rule', ruleset)
      listDiv.removeChild(line)
    })
  }

  label.appendChild(text)
  line.appendChild(label)
  listDiv.appendChild(line)
}

// Set extension enabled/disabled status
function setEnabled (enabled) {
  sendMessage('set_is_extension_enabled', enabled).then(() => {
    // The extension state changed, so reload this tab.
    chrome.tabs.reload()
    window.close()
  })
}

// Set HTTP nowhere mode
function setHttpNowhere (enabled) {
  sendMessage('set_option', { httpNowhere: enabled }).then(() => {
    // The extension state changed, so reload this tab.
    chrome.tabs.reload()
    window.close()
  })
}

/**
 * Fill in content into the popup on load
 */
document.addEventListener('DOMContentLoaded', () => {
  const stableRules = document.getElementById('StableRules')
  const unstableRules = document.getElementById('UnstableRules')
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    const activeTab = tabs[0]

    sendMessage('get_active_rulesets', activeTab.id).then(rulesets => {
      for (const name in rulesets) {
        const listDiv = rulesets[name].default_state ? stableRules : unstableRules

        appendRuleLineToListDiv(rulesets[name], activeTab.id, listDiv)

        // Un-hide the div
        listDiv.className = ''
      }

      // Only show the "Add a rule" link if we're on an HTTPS page
      const isHttps = activeTab.url.slice(0, 6) === 'https:'

      document.getElementById('add-rule-link').style.display = isHttps ? 'block' : 'none'
    })
  })

  // Set up the enabled/disabled switch & hide/show rules
  sendMessage('get_is_extension_enabled').then(enabled => {
    const extensionEnabled = document.getElementById('onoffswitch')
    extensionEnabled.checked = enabled
    extensionEnabled.addEventListener('change', event => {
      setEnabled(event.target.checked)
    })

    // Hide or show the rules sections
    document.body.className = enabled ? '' : 'disabled'
  })

  // Print the extension's current version.
  const versionInfo = document.getElementById('current-version')
  versionInfo.innerText = chrome.runtime.getManifest().version

  // Set up toggle checkbox for HTTP nowhere mode
  sendMessage('get_option', { httpNowhere: false }).then(item => {
    const httpNowhereCheckbox = document.getElementById('http-nowhere-checkbox')
    httpNowhereCheckbox.checked = item.httpNowhere
    httpNowhereCheckbox.addEventListener('change', event => {
      setHttpNowhere(event.target.checked)
    })
  })

  document.getElementById('add-rule-link').addEventListener('click', addManualRule)
})

/**
 * Handles the manual addition of rules
 */
function addManualRule () {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    const url = new URL(tabs[0].url)
    document.getElementById('add-new-rule-div').style.display = 'block'
    document.getElementById('add-rule-link').style.display = 'none'
    document.getElementById('new-rule-host').value = url.host
    document.getElementById('new-rule-regex').value = '^http:'
    document.getElementById('new-rule-redirect').value = 'https:'
    document.getElementById('new-rule-name').value = 'Manual rule for ' + url.host
    document.getElementById('add-new-rule-button').addEventListener('click', () => {
      const params = {
        host: document.getElementById('new-rule-host').value,
        redirectTo: document.getElementById('new-rule-redirect').value,
        urlMatcher: document.getElementById('new-rule-regex').value
      }

      sendMessage('add_new_rule', params).then(() => {
        location.reload()
      })
    })

    document.getElementById('cancel-new-rule').addEventListener('click', () => {
      document.getElementById('add-rule-link').style.display = 'block'
      document.getElementById('add-new-rule-div').style.display = 'none'
    })
    document.getElementById('new-rule-show-advanced-link').addEventListener('click', () => {
      document.getElementById('new-rule-advanced').style.display = 'block'
      document.getElementById('new-rule-regular-text').style.display = 'none'
    })
    document.getElementById('new-rule-hide-advanced-link').addEventListener('click', () => {
      document.getElementById('new-rule-advanced').style.display = 'none'
      document.getElementById('new-rule-regular-text').style.display = 'block'
    })
  })
}
