HTTPS Everywhere
================

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


Installing Dependencies in Debian or Ubuntu
-------------------------------------------

    sudo apt-get install python-lxml python-libxml2 libxml2-utils zip

Installing Dependencies in Mac OS X
-----------------------------------

We recommend Mac users install dependencies using Homebrew:
http://mxcl.github.io/homebrew/

Once you have Homebrew and Xcode installed, run this to install HTTPS Everywhere dependencies.

    brew install python libxml2 gnu-sed

Homebrew puts python in /usr/local/bin, but the python that comes with OS X is in /usr/bin. In order to use homebrew's version of python and pip you must change the order of your path so that /usr/local/bin comes before /usr/bin. This command will force your path to start with /usr/local/bin:

    echo PATH=/usr/local/bin:$PATH >> ~/.profile

After running this close your terminal and then open it again. Then install lxml using pip.

    pip install lxml

Hacking on the Source Code
--------------------------

Please work off of the "3.0" branch if you're submitting changes to the latest stable release and use "master" if you're submitting changes to the latest development release.

### Writing rulesets

HTTPS Everywhere consists of a large number of rules for switching sites from HTTP to HTTPS. You can read more about how to write these rules here: https://www.eff.org/https-everywhere/rulesets

If you want to create new rules to submit to us, we expect them to be in the src/chrome/content/rules directory. That directory also contains a useful script, make-trivial-rule, to create a simple rule for a specified domain. There is also a script called trivial-validate.py, to check all the pending rules for several common errors and oversights. For example, if you wanted to make a rule for the example.com domain, you could run

    sh ./make-trivial-rule example.com

inside the rules directory. This would create Example.com.xml, which you could then take a look at and edit based on your knowledge of any specific URLs at example.com that do or don't work in HTTPS. You could then run

    python ../../../../utils/trivial-validate.py

to make sure that your rule is free of common mistakes.

### Writing translations

If you would like to help translate HTTPS Everywhere into another language, you can do that through Transifex: https://www.transifex.com/projects/p/torproject/resources/.

### Bug trackers and mailing lists

We currently have two bug trackers. The one on Github (https://github.com/EFForg/https-everywhere/issues) is recommended because it gets checked more frequently and has a friendlier user interface. The one on trac.torproject.org (https://trac.torproject.org/projects/tor/report/19) has a large backlog of bugs at this point, but it has the advantage of allowing you to post bugs anonymously using the "cypherpunks" or "writecode" account. (Note that you won't see replies unless you put an email address in the CC field.)

We have two publicly-archived mailing lists: the https-everywhere list (https://lists.eff.org/mailman/listinfo/https-everywhere) is for discussing the project as a whole, and the https-everywhere-rulesets list (https://lists.eff.org/mailman/listinfo/https-everywhere-rules) is for discussing the rulesets and their contents, including patches and git pull requests.

Build Instructions
------------------

To build the Firefox version go to the git repository root and run:

    ./makexpi.sh

To build the Chrome version go to the git repository root and run:

    ./makecrx.sh

After building the extension the xpi files (for Firefox) and crx files (for Chrome) get created in the pkg directory. You can open those files within your browser to install the browser extension.

Ruleset Tests
-------------

You can run ruleset tests by opening `about:config` and changing `extensions.https_everywhere.show_ruleset_tests` to true. Now when you open the HTTPS Everywhere context menu there will be a "Run HTTPS Everywhere Ruleset Tests" menu item.

When you run the tests, be prepared to let your computer run them for a really long time.

Precommit Testing
-----------------

One can run the available test suites automatically by enabling the precommit
hook provided with:

    ln -s ../../hooks/precommit .git/hooks/pre-commit
