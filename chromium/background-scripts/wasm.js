"use strict";

(function(exports) {

const { RuleSets } = wasm_bindgen;

async function initialize() {
  await wasm_bindgen(chrome.runtime.getURL('wasm/https_everywhere_lib_bg.wasm'));
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
