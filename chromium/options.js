/* global sendMessage */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  let json_data = null;
  const import_button = document.getElementById("import");

  document.getElementById("import-settings").addEventListener("change", () => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      try {
        json_data = JSON.parse(reader.result);
      } catch (e) {
        json_data = null;
      }

      import_button.disabled = !json_data;
    });

    reader.addEventListener("error", () => {
      import_button.disabled = true;
    });

    reader.readAsText(file);
  });

  document.getElementById("import-form").addEventListener("submit", event => {
    event.preventDefault();

    sendMessage("import_settings", json_data, () => {
      document.getElementById("import-confirmed").style.display = "block";
      document.getElementById("import-form").style.display = "none";
    });
  });

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
