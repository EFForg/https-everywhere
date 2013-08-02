HTTPS Everywhere
================

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

Build Instructions
------------------

To build the Firefox version go to the git repository root and run:

    ./makexpi.sh

To build the Chrome version go to the git repository root and run:

    ./makecrx.sh

After building the extension the xpi files (for Firefox) and crx files (for Chrome) get created in the pkg directory. You can open those files within your browser to install the browser extension.

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
