// load the HTTPS Everywhere component
var HTTPSEverywhere = null;
try {
  HTTPSEverywhere = Components.classes["@eff.org/https-everywhere;1"]
    .getService(Components.interfaces.nsISupports)
    .wrappedJSObject;
} catch(e) {
  // HTTPS Everywhere doesn't seem to be installed
}

// attach testRunner to the HTTPS Everywhere component so that status.js can run it
if(HTTPSEverywhere) {
  HTTPSEverywhere.httpseRulesetTests = {
    testRunner: testRunner
  };
}

function openStatus() {
  // make sure mixed content blocking preferences are correct
  Services.prefs.setBoolPref("security.mixed_content.block_display_content", false);
  Services.prefs.setBoolPref("security.mixed_content.block_active_content", true);
   
  // open the status tab
  var statusTab = gBrowser.addTab('chrome://https-everywhere/content/ruleset-tests-status.xul');
  gBrowser.selectedTab = statusTab;
}

// FIXME use a class rather than global state
var left_star = new RegExp(/^\*\./); // *.example.com
var accepted_test_targets = {}

function addTestTarget(urls, target, ruleset_ids) {
  // Add one target and associated metadata to the list of
  // URLs to be tested, performing housekeeping along the way
  var active_ids = [];
  if (target in accepted_test_targets) return;

  for (var n = 0; n < ruleset_ids.length; n++) {
    var rs_id = ruleset_ids[n];
    var rs = HTTPSEverywhere.https_rules.rulesetsByID[rs_id];
    if (rs.active) { active_ids.push(rs_id) };
  }
  // Some rulesets that might rewrite this target, let's test them
  if (active_ids.length > 0) {
    urls.push({
      url: 'http://'+target,
      target: target,
      ruleset_ids: active_ids
    });
  }
}

function testRunner() {
  Components.utils.import("resource://gre/modules/PopupNotifications.jsm");
  
  const numTabs = 6;
  var finished = false;
  var output = [];
  var urls = [];
  var num = 0;
  var targets_to_ids = HTTPSEverywhere.https_rules.targets;
  var ruleset_ids;
  accepted_test_targets = {};  // reset each time
 
  // we need every ruleset loaded from DB to check if it's active
  HTTPSEverywhere.https_rules.loadAllRulesets();

  for(var target in targets_to_ids) {
    ruleset_ids = targets_to_ids[target];
    if(target.indexOf("*") == -1)  {
      addTestTarget(urls, target, ruleset_ids);
    } else {
      // target is like *.example.wildcard.com, or www.example.*
      // let's see what we can do...
      var t = target.replace(left_star, "www.");
      if (t.indexOf("*") == -1) {
        addTestTarget(urls, t, ruleset_ids);
      }
    }
  }

  function test() {
    var i;
 
    HTTPSEverywhere.httpseRulesetTests.updateStatusBar(num, urls.length); 

    // start loading all the tabs
    window.focus
    for(i=0; i<numTabs; i++) {
      newTab(num);
    }
  }

  function newTab(number) {
    num +=1;
    // start a test in this tab
    if(urls.length) {

      // open a new tab
      var tab = gBrowser.addTab(urls[number].url);

      // wait for the page to load
      var intervalId = window.setTimeout(function(){

        // detect mixed content blocker
        if(PopupNotifications.getNotification("mixed-content-blocked", gBrowser.getBrowserForTab(tab))) {
          // build output to log
          ruleset_xmls = '';
          for(let i=0; i < urls[number].ruleset_ids.length; i++) {
            ruleset_xmls += urls[number].ruleset_ids[i].xmlName + ', ';
          }
          if(ruleset_xmls != '')
            ruleset_xmls = ruleset_xmls.substring(ruleset_xmls.length-2, 2);
          var output = 'MCB triggered: '+urls[number].url+' ('+ruleset_xmls+')';

          HTTPSEverywhere.httpseRulesetTests.updateLog(output);
        }

        // close this tab, and open another
        closeTab(tab);

      }, 10000);

    } else {

      //to run if urls is empty
      if (!finished) { 
        finished = true;
        window.setTimeout(function(){
          gBrowser.removeCurrentTab();
        }, 10000);
      }
    }
  }

  //closes tab
  function closeTab(tab) {
    HTTPSEverywhere.httpseRulesetTests.updateStatusBar(num, urls.length); 

    gBrowser.selectedTab = tab;
    gBrowser.removeCurrentTab();

    // open a new tab, if the tests haven't been canceled
    if(!HTTPSEverywhere.httpseRulesetTests.cancel) {
      newTab(num);
    }
  }

  //manages write out of output mochilog.txt, which contains sites that trigger mcb
  function writeout(weburl) {

    //initialize file
    var file = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties).
    get("Home", Components.interfaces.nsIFile);
    writeoutfile = "mochilog.txt";
    file.append(writeoutfile);

    //create file if it does not already exist
    if(!file.exists()) {
      file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 420);
    } 

    //initialize output stream
    var stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Components.interfaces.nsIFileOutputStream);

    //permissions are set to append (will not delete existing contents)
    stream.init(file, 0x02 | 0x08 | 0x10, 0666, 0);

    var content = weburl + "\n";

    //Deal with ascii text and write out
    var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
      createInstance(Components.interfaces.nsIConverterOutputStream);
    converter.init(stream, "UTF-8", 0, 0);
    converter.writeString(content);
    converter.close();

    //alternative write out if ascii is not a concern
    //stream.write(content,content.length);
    //stream.close();

  }
  test();
}



