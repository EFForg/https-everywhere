'use strict';

/**
 * @module Browser Session Object
 * @description A centralized storage for browsing data within the browser session.
 */

(function (exports) {

class browserSession {
  constructor() {
    this.tabs = new Map();
    this.requests = new Map();
  }

  // Tab methods
  putTab(tabId, key, value, overwrite) {
    if (!this.tabs.has(tabId)) {
      this.tabs.set(tabId, {});
    }

    if (!(key in this.tabs.get(tabId)) || overwrite) {
      this.tabs.get(tabId)[key] = value;
    }
  }

  getTab(tabId, key, defaultValue) {
    if (this.tabs.has(tabId) && key in this.tabs.get(tabId)) {
      return this.tabs.get(tabId)[key];
    }
    return defaultValue;
  }

  deleteTab(tabId) {
    if (this.tabs.has(tabId)) {
      this.tabs.delete(tabId);
    }
  }

  // Ruleset methods
  putTabAppliedRulesets(tabId, type, ruleset) {
    this.putTab(tabId, "main_frame", false, false);

    // always show main_frame ruleset on the top
    if (type == "main_frame") {
      this.putTab(tabId, "main_frame", true, true);
      this.putTab(tabId, "applied_rulesets", [ruleset,], true);
      return;
    }

    // sort by ruleset names alphabetically, case-insensitive
    if (this.getTab(tabId, "applied_rulesets", null)) {
      let rulesets = this.getTab(tabId, "applied_rulesets");
      let insertIndex = 0;

      const ruleset_name = ruleset.name.toLowerCase();

      for (const item of rulesets) {
        const item_name = item.name.toLowerCase();

        if (item_name == ruleset_name) {
          return;
        } else if (insertIndex == 0 && this.getTab(tabId, "main_frame", false)) {
          insertIndex = 1;
        } else if (item_name < ruleset_name) {
          insertIndex++;
        }
      }
      rulesets.splice(insertIndex, 0, ruleset);
    } else {
      this.putTab(tabId, "applied_rulesets", [ruleset,], true);
    }
  }

  getTabAppliedRulesets(tabId) {
    return this.getTab(tabId, "applied_rulesets", null);
  }

  // Request methods
  putRequest(requestId, key, value) {
    if (!this.requests.has(requestId)) {
      this.requests.set(requestId, {});
    }
    this.requests.get(requestId)[key] = value;
  }

  getRequest(requestId, key, defaultValue) {
    if (this.requests.has(requestId) && key in this.requests.get(requestId)) {
      return this.requests.get(requestId)[key];
    }
    return defaultValue;
  }

  deleteRequest(requestId) {
    if (this.requests.has(requestId)) {
      this.requests.delete(requestId);
    }
  }
}

Object.assign(exports, {
  browserSession
});

})(typeof exports !== 'undefined' ? exports : require.scopes.browser_session = {});
