document.addEventListener("DOMContentLoaded", () => {

  let json_data;
  let import_button = document.querySelector("#import");

  function import_json(e) {
    e.preventDefault();

    let settings = JSON.parse(json_data);
    sendMessage("import_settings", settings, resp => {
      document.querySelector("#import-confirmed").style.display = "block";
      document.querySelector("form").style.display = "none";
    });
  }

  document.querySelector("#import-settings").addEventListener("change", event => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = event => {
      json_data = event.target.result;
      import_button.disabled = false;
    };

    reader.readAsText(file);
  });

  document.querySelector("form").addEventListener("submit", import_json);
});
