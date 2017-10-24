"use strict";

function require(module) {
  if (module.startsWith('./') && require.scopes.hasOwnProperty(module.slice(2))) {
    return require.scopes[module.slice(2)];
  }
  throw new Error('module: ' + module + ' not found.');
}
require.scopes = {};
