pref("extensions.https_everywhere.LogLevel", 5);
pref("extensions.https_everywhere.globalEnabled",true);

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
pref("extensions.https_everywhere._observatory.use_whitelist",true);
