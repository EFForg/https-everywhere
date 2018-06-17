/* exported sendMessage */

"use strict";

function sendMessage(type, object, callback) {
  chrome.runtime.sendMessage({ type, object }, callback);
}
