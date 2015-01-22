# Tests for HTTPS Everywhere

## Prerequisites
* Latest release of the Firefox Add-On SDK as a submodule:
    git submodule update

# Running
    bash test.sh

To add tests, put them in `./https-everywhere-tests/tests`.

# Manual tests

These are test cases to execute manually before a release, and we should
implement them as automated tests:

# Firefox
- Visit a site that triggers a ruleset (e.g., Reddit.com). Verify counter appears on HTTPS
  Everywhere icon.
- Click HTTPS Everywhere icon menu, click 'show counter'. Verify counter
  disappears. Verify checkmark disappears from menu item.
- Click HTTPS Everywhere icon, verify ruleset shows up in green.
- Click ruleset.
- Reopen HTTPS Everywhere icon menu, verify ruleset shows up in grey.
- Reload HTTP version of the site, ensure it doesn't get rewritten now that the
  ruleset is disabled.
- Click HTTP Everywhere icon, click ruleset again.
- Reopen HTTPS Everywhere icon menu, verify ruleset shows up in green.
- Click HTTPS Everywhere icon menu, click 'Enable / disable rules'. This will
  freeze up the browser for a few seconds. Verify it eventually opens up a
  dialog box listing all rules.
- Right-click on a rule, click 'View XML source.' Verify it opens up a dialog
  box and shows the rule source.
- Click HTTPS Everywhere icon menu, click 'Block all HTTP requests'. Verify icon
  turns red.
- Visit an HTTP site known to not have a rewrite rule. http://amazon.com is a
  good example. Verify page does not load.
- Visit an HTTPS site that contains passive mixed content that is not rewritten
  to HTTPS. https://jacob.hoffman-andrews.com/passive-mixed-content.html is a
  good example. Verify the passive mixed content (e.g., image) does not load.
  NOTE: Currently fails. https://github.com/EFForg/https-everywhere/issues/857
- Click icon menu, click 'About HTTPS Everywhere.' Verify dialog opens.
- Click icon menu, click 'SSL Observatory Preferences.' Verify dialog opens.
- Click icon menu, click 'Disable HTTPS Everywhere.' Verify icon turns grey.
- Visit a site that would normally trigger a ruleset. Verify it is not rewritten
  to HTTPS.
- Click icon menu, click 'Enable HTTPS Everywhere.' Verify icon turns blue.
  Verify page reloads and is rewritten to HTTPS.
- Look at log output, look for errors. Make sure certificates are being
submitted to SSL Observatory
- Tools > Web Developer > Browser Toolbox > Console. Check for errors.
- TODO: Test translations?

# Chromium

- Visit a site that triggers a ruleset (e.g., Reddit.com). Verify counter appears
  on HTTPS Everywhere icon.
- Click HTTPS Everywhere icon menu. Verify it contains appropriate ruleset.
- Disable ruleset.
- Visit HTTP version of the site again. Verify it does not get redirected to
  HTTPS.
- Re-enable ruleset.
- Visit HTTP version of the site again. Verify it does get redirected.
- Visit site that does not have a ruleset. From icon menu, click 'Add this
  site', and complete site-adding process.
- Reload the site. Verify it gets redirected to HTTPS.
