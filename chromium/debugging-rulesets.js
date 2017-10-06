/* global sendMessage */

"use strict";

document.getElementById("debugging-rulesets-form").addEventListener("submit", save_debugging_rulesets);

sendMessage("get_option", { debugging_rulesets: "" }, item => {
  let debugging_rulesets_textarea = document.getElementById("debugging-rulesets");
  debugging_rulesets_textarea.value = item.debugging_rulesets;
  debugging_rulesets_textarea.style.display = "block";
});

function save_debugging_rulesets(e){
  e.preventDefault();
  sendMessage("set_option", { debugging_rulesets: document.getElementById("debugging-rulesets").value }, () => {
    const saved = document.getElementById("saved");
    saved.style.display = "block";
    setTimeout(() => { saved.style.display = "none" }, 1000);
  });
}
