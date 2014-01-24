HTTPS Everywhere for Fennec (Firefox Mobile)
============================================

About
-----

This is a hard alpha of HTTPS Everywhere for Fennec (Firefox Mobile), based on HTTPS Everywhere 3.4.5 (stable). Send bug reports to yan@eff.org or open as issues on Github: https://github.com/diracdeltas/https-everywhere.

![](/httpsemobile.png "Screenshot 1")

Features
--------

* Rewrites requests with HTTPS Everywhere rules from the current stable release (3.4.5).
* Click on the HTTPS Everywhere icon in the URL bar to enable/disable rules on the current page.
* Long-click on the icon to reset rules to defaults.
* Adds an item to the Firefox mobile menu to toggle HTTPS Everywhere on/off.

Testing
-------

Requirements:
* Firefox Mobile 26(?)+ on an Android device.
* Android SDK

To test:
* Run `makexpi.sh` to create a test.xpi and automatically push it to your Android device.
* Run with the `--fast` option to skip ruleset validation.

Known Issues
------------

* The list of applicable rules is sometimes empty when a page location changes until the page is reloaded.
