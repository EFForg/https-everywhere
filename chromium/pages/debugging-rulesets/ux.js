/* global sendMessage, CodeMirror */

"use strict";

const savedTextElement = document.getElementById("saved-text");
const unsavedTextElement = document.getElementById("unsaved-text");
const savedTitle = "Debugging Rulesets";
const unsavedTitle = "* Debugging Rulesets";

document.title = savedTitle;

const cm = CodeMirror.fromTextArea(
  document.getElementById("codemirror-textarea"),
  {
    mode: "xml",
    theme: "default main saved"
  }
);

let valueHasChanged = false;
sendMessage("get_option", { debugging_rulesets: "" }, item => {
  cm.setValue(item.debugging_rulesets);
  cm.on("change", cm => {
    if (!(valueHasChanged)) {
      valueHasChanged = true;
      document.title = unsavedTitle;
      cm.setOption("theme", "default main unsaved");
      unsavedTextElement.style.visibility = "visible";
    }
  });
});

document.getElementById("save-button").addEventListener("click", e => {
  e.preventDefault();
  sendMessage("set_option", { debugging_rulesets: cm.getValue() }, () => {
    savedTextElement.style.display = "block";
    setTimeout(() => {
      savedTextElement.style.display = "none";
    }, 1000);

    valueHasChanged = false;
    document.title = savedTitle;
    cm.setOption("theme", "default main saved");
    unsavedTextElement.style.visibility = "hidden";
  });
});
