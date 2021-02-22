#!/usr/bin/env python3.6
#
# Run Selenium tests for HTTPS Everywhere
#
# This script may be executed as `python3.6 script.py [directory of CRX]`
#
# The script is compatible with Python 3.6.
# Selenium, WebDriver and Google Chrome (or Chromium) must be installed
# in order for the script to run successfully. A desktop version
# of linux is required for the script to run correctly as well.
# Otherwise, use pyvirtualdisplay.

import sys, os, time
from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.firefox.firefox_binary import FirefoxBinary

class bcolors:
    OKGREEN = '\033[92m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'


if sys.argv[1] == "Chrome":
    chromeOps = webdriver.ChromeOptions()
    chromeOps.add_extension(sys.argv[2])
    if os.getuid() == 0:
        chromeOps.add_argument("--no-sandbox")

    # Find the path to chromedriver
    chromedriver_path = "chromedriver"
    if sys.platform.startswith("linux"):
        locations = (
            "/usr/lib/chromium-browser/chromedriver",
            "/usr/lib/chromium/chromedriver",
        )
        for location in locations:
            if os.path.isfile(location):
                chromedriver_path = location
                break

    try:
        # First argument is optional, if not specified will search path.
        driver = webdriver.Chrome(chromedriver_path, chrome_options=chromeOps)
    except WebDriverException as e:
        error = e.__str__()

        if "executable needs to be in PATH" in e.__str__():
            print("ChromeDriver isn't installed. Check test/chromium/README.md " \
                "for instructions on how to install ChromeDriver")

            sys.exit(2)
        else:
            raise e

if sys.argv[1] == "Firefox":
    fp = webdriver.FirefoxProfile(sys.argv[2])
    try:
        if len(sys.argv) == 4:
            binary = FirefoxBinary(sys.argv[3])
            driver = webdriver.Firefox(fp, firefox_binary=binary, log_path=os.devnull)
        else:
            driver = webdriver.Firefox(fp, log_path=os.devnull)
    except WebDriverException as e:
        error = e.__str__()

        if "executable needs to be in PATH" in e.__str__():
            print("GeckoDriver isn't installed. Check test/firefox/README.md " \
                "for instructions on how to install GeckoDriver")

            sys.exit(2)
        else:
            raise e

    # Allow the extension time to load
    time.sleep(1)

print('')

driver.get('http://freerangekitten.com')

test_failed = False
if driver.current_url.startswith('https'):
    print(bcolors.OKGREEN + sys.argv[1] + ": HTTP to HTTPS redirection successful" + bcolors.ENDC)
elif driver.current_url.startswith('http'):
    print(bcolors.FAIL + sys.argv[1] + ": HTTP to HTTPS redirection failed" + bcolors.ENDC)
    test_failed = True

print('')

driver.quit()

if test_failed:
    sys.exit(1)
