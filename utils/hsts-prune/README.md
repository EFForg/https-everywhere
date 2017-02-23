# HTTPS Everywhere - HSTS Prune

Running this will remove targets from the rulesets which are preloaded in Firefox {Dev, Stable, ESR} as well as the latest Chromium head.  If all targets would be removed from a ruleset, the ruleset itself is instead deleted.

## Installing Dependencies

    npm install

## Running

    node index.js
