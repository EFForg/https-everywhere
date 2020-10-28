"use strict";
/**
 * @see for Rust Based Library:
 * https://github.com/EFForg/https-everywhere-lib-core
 */
(function(exports) {

const util = require('./log'),
  { RuleSets } = wasm_bindgen;

async function initialize() {
  try {
    await wasm_bindgen(chrome.runtime.getURL('wasm/https_everywhere_lib_wasm_bg.wasm'));
  } catch(e) {
    util.log(util.WARN, 'The wasm library has not loaded correctly: ' + e);
  }
}

function is_enabled() {
  return true;
}

Object.assign(exports, {
  initialize,
  RuleSets,
  is_enabled,
});

})(typeof exports == 'undefined' ? require.scopes.wasm = {} : exports);
