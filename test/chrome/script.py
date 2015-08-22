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

import time, sys, glob, os, traceback
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.common.by import By

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

driver = webdriver.Chrome('/usr/bin/chromedriver', chrome_options = chromeOps)  # Optional argument, if not specified will search path.
driver.get('http://libssh.org/robots.txt')

#Page Loaded

if driver.current_url.startswith('https'):
	print bcolors.OKGREEN + "HTTP to HTTPS redirection successful" + bcolors.ENDC
elif(driver.current_url.startswith('http')):
	print bcolors.FAIL + "HTTP to HTTPS redirection failed" + bcolors.ENDC

print '' #New line

driver.quit()