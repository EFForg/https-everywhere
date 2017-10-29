// Make it quicker to make manual config changes.
user_pref("general.warnOnAboutConfig", false);
// Minimize unnecessary requests.
user_pref("browser.safebrowsing.enabled", false);
user_pref("browser.safebrowsing.malware.enabled", false);
// These two preferences allow debugging the extension
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.remote-enabled", true);
// Disable signature requirement so we can run testing addons
user_pref("xpinstall.signatures.required", false);
