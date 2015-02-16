HTTPS Everywhere [![Build Status](https://travis-ci.org/EFForg/https-everywhere.svg?branch=master)](https://travis-ci.org/EFForg/https-everywhere)
================

Getting Started
---------------

Get the packages you need and install a git hook to run tests before push:

    bash install-dev-dependencies.sh

Run the tests for the Firefox version:

    bash test.sh

Run the latest code and rulesets in a standalone Firefox profile:

    bash test.sh --justrun

Run the latest code and rulesets in a standalone Chromium profile:

    bash run-chromium.sh

Build the Firefox extension as a .xpi package:

    bash makexpi.sh

Build the Chromium extension as a .crx package:

    bash makecrx.sh

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

Hacking on the Source Code
--------------------------

The current stable release series is 4.0. The current development release series
is 5.0. Each release series is represented by a branch with the major and minor
version numbers, e.g. 4.0 or 5.0. This branch is updated during the lifecycle of
the release series. Specific releases are represented as tags with the full
version number, e.g. 4.0.0 or 5.0development.0.

If you are making a bug fix to the current stable release, you should
work off of the stable branch, 4.0. If you are adding features or improving
functionality, work off of master. The maintainers will merge master into the
development series branch periodically. We will also occasionally merge ruleset
fixes from master into the stable branch if the ruleset is important (i.e. a
popular or high-security site), or if the version in stable is clearly broken.

To submit changes, either use pull requests on GitHub or email patches to
https-everywhere-rulesets@lists.eff.org (rulesets) or
https-everywhere@lists.eff.org (code).

### Writing rulesets

HTTPS Everywhere consists of a large number of rules for switching sites from HTTP to HTTPS. You can read more about how to write these rules here: https://www.eff.org/https-everywhere/rulesets

If you want to create new rules to submit to us, we expect them to be in the src/chrome/content/rules directory. That directory also contains a useful script, make-trivial-rule, to create a simple rule for a specified domain. There is also a script called trivial-validate.py, to check all the pending rules for several common errors and oversights. For example, if you wanted to make a rule for the example.com domain, you could run

    bash ./make-trivial-rule example.com

inside the rules directory. This would create Example.com.xml, which you could then take a look at and edit based on your knowledge of any specific URLs at example.com that do or don't work in HTTPS. You should then run

    bash test.sh

to make sure that your rule is free of common mistakes.

### Writing translations

If you would like to help translate HTTPS Everywhere into your language,
you can do that through the Tor Project's Transifex page:
https://www.transifex.com/projects/p/torproject/.

### Bug trackers and mailing lists

We currently have two bug trackers. The one on Github (https://github.com/EFForg/https-everywhere/issues) is recommended because it gets checked more frequently and has a friendlier user interface. The one on trac.torproject.org (https://trac.torproject.org/projects/tor/report/19) has a large backlog of bugs at this point, but it has the advantage of allowing you to post bugs anonymously using the "cypherpunks" / "writecode" account. (Note that you won't see replies unless you put an email address in the CC field.)

We have two publicly-archived mailing lists: the https-everywhere list (https://lists.eff.org/mailman/listinfo/https-everywhere) is for discussing the project as a whole, and the https-everywhere-rulesets list (https://lists.eff.org/mailman/listinfo/https-everywhere-rules) is for discussing the rulesets and their contents, including patches and git pull requests.

Tests
-------------

There are some very basic unittests under https-everywhere-tests/. These are run with

    bash test.sh

Please help write more unittests and integration tests!

There are also ruleset tests, which aim to find broken rulesets by actually
loading URLs in a browser and watching for Mixed Content Blocking to fire.
The easiest way to run ruleset tests is to load a standalone Firefox instance
with the tests enabled:

    bash test.sh --justrun

Then click the HTTPS Everywhere icon on the toolbar, and click "Run HTTPS
Everywhere Ruleset Tests." When you run the tests, be prepared to let your
computer run them for a really long time.
