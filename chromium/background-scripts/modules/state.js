"use strict";

/**
 * @module Methods for determining state of extension (Disabled/Enabled)
 */

(function (exports) {

let validation = require('./validation');

/**
 * @description Check if HTTPS Everywhere should be ON for host
 * @param {string} host
 */
function isExtensionDisabledOnSite(host, httpOnceList, disabledList) {
  // make sure the host is not matched in the httpOnceList
  if (httpOnceList.has(host)) {
    return true;
  }

  // make sure the host is not matched in the disabledList
  if (disabledList.has(host)) {
    return true;
  }

  // make sure the host is matched by any wildcard expressions in the disabledList
  const expressions = validation.getWildcardExpressions(host);
  for (const expression of expressions) {
    if (disabledList.has(expression)) {
      return true;
    }
  }

  // otherwise return false
  return false;
}

Object.assign(exports, { isExtensionDisabledOnSite });

})(typeof exports !== 'undefined' ? exports : require.scopes.state = {});