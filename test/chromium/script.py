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

import sys
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

# First argument is optional, if not specified will search path.

try:
	driver = webdriver.Chrome('chromedriver', chrome_options=chromeOps)
except WebDriverException as e:
	error = e.__str__()

	if "executable needs to be in PATH" in e.__str__():
		print "ChromeDriver isn't installed. Check test/chrome/README.md\
		 for instructions on how to install ChromeDriver"
		sys.exit(2)
	else:
		driver.quit()
		raise e

print '' #New line

driver.get('http://libssh.org/robots.txt')

#Page Loaded

if driver.current_url.startswith('https'):
	print bcolors.OKGREEN + "HTTP to HTTPS redirection successful" + bcolors.ENDC
elif driver.current_url.startswith('http'):
	print bcolors.FAIL + "HTTP to HTTPS redirection failed" + bcolors.ENDC
	sys.exit(1)

print '' #New line

driver.quit()
