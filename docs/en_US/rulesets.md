## HTTPS Everywhere Rulesets

This page introduces the rulessets for [HTTPS Everywhere](https://eff.org/https-everywhere), a browser extension that switches sites over from HTTP to HTTPS automatically. HTTPS Everywhere comes with [thousands](http://www.eff.org/https-everywhere/atlas/) of rulesets that tell HTTPS Everywhere which sites it should switch to HTTPS and how.

#### [Rulesets](#rulesets)

Previously, one can manually create and test the ruleset by placing it in the `HTTPSEverywhereUserRules/` subdirectory in [the Firefox profile directory](http://kb.mozillazine.org/Profile_folder_-_Firefox), and then restarting Firefox. However, this feature is no longer supported and will not be supported with the HTTPS Everywhere WebExtensions. This is because there is no longer any way to do arbitrary file reads from within WebExtensions.

For customized rules, one can still use the User Interface of HTTPS Everywhere, specifically, by clicking on the HTTPS Everywhere icon and then click `Add a rule for this site`.