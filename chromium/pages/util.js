/* exported e */
/* exported hide */
/* exported show */
/* exported getOption_ */

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
