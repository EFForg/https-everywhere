/* global sendMessage */

"use strict";

const debugging_rulesets_textarea = document.getElementById("debugging-rulesets");
const changed = document.getElementById("changed");
const default_title = "Debugging Rulesets";
const unsaved_title = "* Debugging Rulesets";

debugging_rulesets_textarea.addEventListener("input", debugging_rulesets_changed);
document.getElementById("debugging-rulesets-form").addEventListener("submit", save_debugging_rulesets);

document.title = default_title;

sendMessage("get_option", { debugging_rulesets: "" }, item => {
  debugging_rulesets_textarea.value = item.debugging_rulesets;
  debugging_rulesets_textarea.style.display = "block";
});

function save_debugging_rulesets(e){
  e.preventDefault();
  sendMessage("set_option", { debugging_rulesets: debugging_rulesets_textarea.value }, () => {
    const saved = document.getElementById("saved");
    saved.style.display = "block";
    setTimeout(() => { saved.style.display = "none" }, 1000);

    document.title = default_title;
    debugging_rulesets_textarea.className = "";
    changed.style.visibility = "hidden";
  });
}

function debugging_rulesets_changed(){
  debugging_rulesets_textarea.className = "unsaved";
  document.title = unsaved_title;
  changed.style.visibility = "visible";
}
