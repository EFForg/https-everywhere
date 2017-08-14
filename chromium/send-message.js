'use strict'

function sendMessage (type, object) {
  return new Promise(resolve => {
  	chrome.runtime.sendMessage({ type, object }, resolve)
  })
}
