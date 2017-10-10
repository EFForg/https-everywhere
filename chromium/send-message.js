/* exported sendMessage */

"use strict";

function sendMessage(type, object, callback) {
  var packet = {};
  packet.type = type;
  if(object){
    packet.object = object;
  }
  chrome.runtime.sendMessage(packet, callback);
}
