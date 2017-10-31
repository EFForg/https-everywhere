[HTTPS Everywhere](https://www.eff.org/https-everywhere) [![Build Status](https://travis-ci.org/EFForg/https-everywhere.svg?branch=master)](https://travis-ci.org/EFForg/https-everywhere)
[![Coverage Status](https://coveralls.io/repos/github/EFForg/https-everywhere/badge.svg?branch=master)](https://coveralls.io/github/EFForg/https-everywhere?branch=master)
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

    utils/                    Various utilities

Hacking on the Source Code
--------------------------

Please refer to our [contributing](CONTRIBUTING.md) document to contribute to the project.

Legal notices
-------------

Copyright © 2010-2017 Electronic Frontier Foundation and others.

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

The text of GNU General Public License version 2 may be found in LICENSE.txt file.

The build system incorporates code from Python 2.6, which is copyright © 2001-2006 Python Software Foundation and is licensed under Python Software Foundation License Version 2.
