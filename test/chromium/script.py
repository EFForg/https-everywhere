#!/usr/bin/env python2.7
#
# Run Chromium tests for HTTPS Everywhere
#
# This script may be executed as `python script.py [directory of CRX]`
#
# The script is compatible with Python 2. Python 3 is not tested.
# Selenium, WebDriver and Google Chrome (or Chromium) must be installed
# in order for the script to run successfully. A desktop version
# of linux is required for the script to run correctly as well.
# Otherwise, use pyvirtualdisplay.

import sys, os, platform
from selenium import webdriver
from selenium.common.exceptions import WebDriverException

class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


chromeOps = webdriver.ChromeOptions()
chromeOps.add_extension(sys.argv[1])

# Find the path to chromedriver
chromedriver_path = "chromedriver"
if sys.platform.startswith("linux"):
    if 'Ubuntu' in platform.linux_distribution():
        chromedriver_path = "/usr/lib/chromium-browser/chromedriver"
    elif 'debian' in platform.linux_distribution():
        #Debian is lowercase when platform.linux_distribution() is used.
        #This is not a mistake.
        chromedriver_path = "/usr/lib/chromium/chromedriver"

try:
    # First argument is optional, if not specified will search path.
    driver = webdriver.Chrome(chromedriver_path, chrome_options=chromeOps)
except WebDriverException as e:
    error = e.__str__()

    if "executable needs to be in PATH" in e.__str__():
        print "ChromeDriver isn't installed. Check test/chromium/README.md " \
              "for instructions on how to install ChromeDriver"

        sys.exit(2)
    else:
        raise e

print ''

driver.get('http://libssh.org/robots.txt')

test_failed = False
if driver.current_url.startswith('https'):
    print bcolors.OKGREEN + "Chromium: HTTP to HTTPS redirection successful" + bcolors.ENDC
elif driver.current_url.startswith('http'):
    print bcolors.FAIL + "Chromium: HTTP to HTTPS redirection failed" + bcolors.ENDC
    test_failed = True

print ''

driver.quit()

if test_failed:
    sys.exit(1)
