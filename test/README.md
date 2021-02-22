# Automated Tests for HTTPS Everywhere

## Running

    bash test.sh

## Requirements for Selenium Testing

- Python 3.6
- Selenium
      - Install Selenium as a python package using ```pip3 install selenium```, or run install-dev-dependencies.sh and it will do the job
- GeckoDriver
      - Manually download GeckoDriver from [here](https://github.com/mozilla/geckodriver/releases). Extract the executable to `/usr/bin/`, so that the pasted executable's full path becomes `/usr/bin/geckodriver`.

# List of Manual tests

These are integrated into Travis for automated end-to-end testing within Firefox and Chrome/Chromium browsers

# Firefox

- Visit a site that triggers a ruleset (e.g., Reddit.com).
- Click HTTPS Everywhere icon, verify ruleset shows up in blue.
- Click 'show more' text and view ruleset and toggle off ruleset.
- Reopen HTTPS Everywhere menu, verify ruleset shows up in grey.
- Reload HTTP version of the site, ensure it doesn't get rewritten now that the ruleset is disabled.
- Click HTTP Everywhere icon, click ruleset again.
- Click HTTPS Everywhere icon menu, click 'Encrypt All Sites Eligible'. Verify icon
  turns red.
- Visit an HTTP site known to not have a rewrite rule. http://http.badssl.com is a
  good example. Verify page does not load.
- Visit an HTTPS site that contains passive mixed content that is not rewritten
  to HTTPS. https://jacob.hoffman-andrews.com/passive-mixed-content.html is a
  good example. Verify the passive mixed content (e.g., image) does not load.
- Click menu, click 'HTTPS Everywhere is ON' to 'HTTPS Everywhere is OFF' Verify icon turns grey.
- Visit a site that would normally trigger a ruleset. Verify it is not rewritten to HTTPS.
- Click menu, click 'Enable HTTPS Everywhere.' Verify icon turns blue. Verify page reloads and is rewritten to HTTPS.
- Look at log output, look for errors.
- Browser Menu > Web Developer > Web Console. Check for errors.

# Chromium

- Visit a site that triggers a ruleset (e.g., Reddit.com). Verify counter appears
  within the HTTPS Everywhere menu under 'show more'.
- Click HTTPS Everywhere menu. Verify it contains appropriate ruleset.
- Disable ruleset.
- Visit HTTP version of the site again. Verify it does not get redirected to HTTPS.
- Re-enable ruleset.
- Visit HTTP version of the site again. Verify it does get redirected.
- Visit site that does not have a ruleset. Under the 'show more' menu, click 'Add this site', and complete site-adding process.
- Reload the site. Verify it gets redirected to HTTPS.
