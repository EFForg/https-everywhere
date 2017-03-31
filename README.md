[HTTPS Everywhere](https://www.eff.org/https-everywhere) [![Build Status](https://travis-ci.org/EFForg/https-everywhere.svg?branch=master)](https://travis-ci.org/EFForg/https-everywhere)
================

Getting Started
---------------

Get the packages you need and install a git hook to run tests before push:

    bash install-dev-dependencies.sh

Run all the tests:

    bash test.sh

Run the latest code and rulesets in a standalone Firefox profile:

    bash test/firefox.sh --justrun

Run the latest code and rulesets in a standalone profile for a specific version of Firefox:

    FIREFOX=/path/to/firefox bash test/firefox.sh --justrun

Run the latest code and rulesets in a standalone Chromium profile:

    bash test/chromium.sh --justrun

Run the latest code and rulesets in a standalone Tor Browser profile:

    bash test/tor path_to_tor_browser.tar.xz

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

    src/                      The Firefox source

    chromium/                 The Chromium/Chrome source
                              (not to be confused with Firefox browser "chrome" or UI)

    src/components            |
    src/chrome/content        | Firefox JavaScript and XUL code
    src/chrome/content/code   |

    src/chrome/content/rules  The rulesets live here

    test/                     The tests live here

    util/                     Various utilities

Hacking on the Source Code
--------------------------

Please refer to our [contributing](CONTRIBUTING.md) document to contribute to the project.
