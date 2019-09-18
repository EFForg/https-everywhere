/* exported e */
/* exported hide */
/* exported show */
/* exported sendMessage */
/* exported getOption_ */
/* exported setOption_ */

"use strict";

/**
 * Element helper functions
 */
function e(id) {
  return document.getElementById(id);
}

function hide(elem) {
  elem.style.display = "none";
}

function show(elem) {
  elem.style.display = "block";
}

function sendMessage(type, object, callback) {
  chrome.runtime.sendMessage({ type, object }, callback);
}

/**
* Get an option from global settings
* @param {string} opt
* @param {mixed} defaultOpt
* @param {object} callback
* @returns mixed
*/
function getOption_(opt, defaultOpt, callback) {
  let details = {};
  details[opt] = defaultOpt;
  sendMessage("get_option", details, callback);
}

function setOption_(opt, value, callback) {
  var details = {};
  details[opt] = value;
  sendMessage("set_option", details, callback);
}
