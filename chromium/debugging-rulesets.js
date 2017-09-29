/* global sendMessage */

"use strict";

window.onload = function() {
  document.querySelector("form").addEventListener("submit", save_debugging_rulesets);

  sendMessage("get_option", { debugging_rulesets: "" }, item => {
    document.getElementById("debugging-rulesets").value = item.debugging_rulesets;
  });
}

function save_debugging_rulesets(e){
  e.preventDefault();
  sendMessage("set_option", { debugging_rulesets: document.getElementById("debugging-rulesets").value }, () => {
    const saved = document.getElementById("saved");
    saved.style.display = "block";
    setTimeout(() => { saved.style.display = "none" }, 1000);
  });
}
