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

  const showCounter = document.getElementById("showCounter");
  const counterColor = document.getElementById("counterColor");

  sendMessage("get_option", { showCounter: true, counterColor: "#00cc00" }, item => {
    showCounter.checked = item.showCounter;
    counterColor.style.display = item.showCounter ? '' : 'none';
    counterColor.value = item.counterColor;

    showCounter.addEventListener("change", event => {
      sendMessage("set_option", { showCounter: showCounter.checked });
      counterColor.style.display = showCounter.checked ? '' : 'none';
    });

    counterColor.addEventListener("change", event => {
      sendMessage("set_option", { counterColor: counterColor.value });
    });
  });
});
