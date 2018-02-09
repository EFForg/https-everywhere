[HTTPS Everywhere](https://www.eff.org/https-everywhere) [![Build Status](https://travis-ci.org/EFForg/https-everywhere.svg?branch=master)](https://travis-ci.org/EFForg/https-everywhere)
[![Coverage Status](https://coveralls.io/repos/github/EFForg/https-everywhere/badge.svg?branch=master)](https://coveralls.io/github/EFForg/https-everywhere?branch=master)
================

Getting Started
---------------

Get the packages you need and install a git hook to run tests before push:

    bash install-dev-dependencies.sh

Run the ruleset validations and browser tests:

    bash test.sh

Run the latest code and rulesets in a standalone Firefox profile:

    bash test/firefox.sh --justrun

Run the latest code and rulesets in a standalone profile for a specific version of Firefox:

    FIREFOX=/path/to/firefox bash test/firefox.sh --justrun

Run the latest code and rulesets in a standalone Chromium profile:

    bash test/chromium.sh --justrun

Run the latest code and rulesets in a standalone Tor Browser profile:

    bash test/tor-browser.sh path_to_tor_browser.tar.xz

Build the Firefox (.xpi) & Chromium (.crx) extensions:

    bash make.sh

Both of the build commands store their output under pkg/.

Precommit Testing
-----------------

One can run the available test suites automatically by enabling the precommit
hook provided with:

    ln -s ../../hooks/precommit .git/hooks/pre-commit

Source Tree
-----------

This is the source tree for HTTPS Everywhere for Firefox and Chrome.

Important directories you might want to know about


    chromium/                 WebExtension source code (for Firefox & Chromium/chrome)
    chromium/external         External dependencies
    chromium/test             Unit tests

    rules/                    Symbolic link to src/chrome/content/rules

    src/chrome/content/rules  Ruleset files live here

    test/                     Travis unit test source code live here

    utils/                    Various utilities (includes some Travis test source)

Hacking on the Source Code
--------------------------

Please refer to our [contributing](CONTRIBUTING.md) document to contribute to the project.
