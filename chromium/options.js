document.addEventListener("DOMContentLoaded", function () {

  let json_data;
  let import_button = document.querySelector("#import");

  async function import_json(e) {
    e.preventDefault();

    let settings = JSON.parse(json_data);

    if(settings.changed){
      await sendMessagePromise("add_rulesets_from_string_array", settings.custom_rulesets);

      let rule_toggle_promises = [];
      for(ruleset_name in settings.rule_toggle){
        localStorage[ruleset_name] = settings.rule_toggle[ruleset_name];

        let set_ruleset = {
          active: settings.rule_toggle[ruleset_name],
          name: ruleset_name
        };

        rule_toggle_promises.push(sendMessagePromise("set_ruleset_active_status_by_name", set_ruleset));
      }
      await Promise.all(rule_toggle_promises);
      await sendMessagePromise("delete_all_ruleset_cache");

      await sendMessagePromise("set_option", {'httpNowhere': settings.prefs.http_nowhere_enabled});
      await sendMessagePromise("set_option", {'showCounter': settings.prefs.show_counter});
      await sendMessagePromise("set_is_extension_enabled", settings.global_enabled);

      document.querySelector("#import-confirmed").style.display = "block";
      document.querySelector("form").style.display = "none";
    }
  }

  function sendMessagePromise(type, object){
    return new Promise(resolve => {
      sendMessage(type, object, resp => {
        resolve(resp);
      });
    });
  }

  document.querySelector("#import-settings").addEventListener("change", function(event) {
    var file = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function(event) {
      json_data = event.target.result;
      import_button.disabled = false;
    };

    reader.readAsText(file);
  });

  document.querySelector("form").addEventListener("submit", import_json);
});
