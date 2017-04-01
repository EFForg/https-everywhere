// Submit SSL Observatory reports.
user_pref("extensions.https_everywhere._observatory.enabled", true);
// Don't show any popups that might get in the way of testing.
user_pref("extensions.https_everywhere._observatory.popup_shown", true);
user_pref("extensions.https_everywhere.toolbar_hint_shown", true);
// Show all logs.
user_pref("extensions.https_everywhere.LogLevel", 0);
user_pref("extensions.https_everywhere.log_to_stdout", true);
// Make it quicker to make manual config changes.
user_pref("general.warnOnAboutConfig", false);
// Minimize unnecessary requests.
user_pref("browser.safebrowsing.enabled", false);
user_pref("browser.safebrowsing.malware.enabled", false);
// These two preferences allow debugging the extension
// using Tools > Web Developer > Browser Toolbox
// (Note: Since this is not an SDK extension, you can't use the Addon
// Debugger, but the Browser Toolbox is just about as good).
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.remote-enabled", true);
// Disable signature requirement so we can run testing addons
user_pref("xpinstall.signatures.required", false);
