/* global sendMessage */

"use strict";

document.addEventListener("DOMContentLoaded", () => {

  let json_data;
  let import_button = document.querySelector("#import");

  function import_json(e) {
    e.preventDefault();

    let settings = JSON.parse(json_data);
    sendMessage("import_settings", settings, () => {
      document.querySelector("#import-confirmed").style.display = "block";
      document.querySelector("form").style.display = "none";
    });
  }

  document.querySelector("#import-settings").addEventListener("change", () => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.addEventListener("load", event => {
      json_data = event.target.result;
      import_button.disabled = false;
    });

    reader.readAsText(file);
  });

  document.querySelector("form").addEventListener("submit", import_json);

  const showCounter = document.getElementById("showCounter");

  sendMessage("get_option", { showCounter: true }, item => {
    showCounter.checked = item.showCounter;
    showCounter.addEventListener("change", () => {
      sendMessage("set_option", { showCounter: showCounter.checked });
    });
  });

  document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.ctrlKey && evt.keyCode == 90) {
      window.open("debugging-rulesets.html");
    }
  };
});
