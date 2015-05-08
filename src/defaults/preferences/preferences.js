pref("extensions.https_everywhere.LogLevel", 5);
pref("extensions.https_everywhere.log_to_stdout", false);
pref("extensions.https_everywhere.globalEnabled",true);

// this is the HTTPS Everywhere preferences version (for migrations)
pref("extensions.https_everywhere.prefs_version", 0);

// this is a popup asking whether the user really meant to be on the dev branch
pref("extensions.https_everywhere.dev_popup_shown", false);

// show ruleset tests in the menu
pref("extensions.https_everywhere.show_ruleset_tests", false);
// run a ruleset performance test at startup
pref("extensions.https_everywhere.performance_tests", false);

// enable rulesets that trigger mixed content blocking
pref("extensions.https_everywhere.enable_mixed_rulesets", false);

// HTTP Nowhere preferences
pref("extensions.https_everywhere.http_nowhere.enabled", false);
pref("extensions.https_everywhere.http_nowhere.orig.ocsp.required", false);

// SSl Observatory preferences
pref("extensions.https_everywhere._observatory.enabled",false);

// "testing" currently means send unecessary fingerprints and other test-suite
// type stuff
pref("extensions.https_everywhere._observatory.testing",false);

pref("extensions.https_everywhere._observatory.server_host","observatory.eff.org");
pref("extensions.https_everywhere._observatory.use_tor_proxy",true);
pref("extensions.https_everywhere._observatory.submit_during_tor",true);
pref("extensions.https_everywhere._observatory.submit_during_nontor",true);

pref("extensions.https_everywhere._observatory.cache_submitted",true);

pref("extensions.https_everywhere._observatory.use_custom_proxy",false);
pref("extensions.https_everywhere._observatory.popup_shown",false);
pref("extensions.https_everywhere._observatory.proxy_host","");
pref("extensions.https_everywhere._observatory.proxy_port",0);
pref("extensions.https_everywhere._observatory.proxy_type","direct");
pref("extensions.https_everywhere._observatory.use_tor_proxy",true);
pref("extensions.https_everywhere._observatory.alt_roots",false);
pref("extensions.https_everywhere._observatory.self_signed",true);
pref("extensions.https_everywhere._observatory.priv_dns",false);
pref("extensions.https_everywhere._observatory.send_asn",true);
pref("extensions.https_everywhere._observatory.show_cert_warning",true);
pref("extensions.https_everywhere._observatory.use_whitelist",true);
pref("extensions.https_everywhere._observatory.clean_config",false);

pref("extensions.https_everywhere._observatory.whitelist_update_due",0);
