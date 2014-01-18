#! /usr/bin/env python3.3

# Copyright 2014 Claudio Moretti <flyingstar16@gmail.com>
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.

#
# This little piece of software works by downloading the Alexa Top 1M website list, which freely available,
# then it uses `git diff` to generate a list of XML ruleset files that are in the master branch but not in stable.
# Finally, it compares the two and prints the file name and path of every ruleset file that
# a) is in master but not in stable and
# b) has a target in the Alexa Top1M list
#

import sys
import csv
import xml.etree.ElementTree as etree
import subprocess
import random
import urllib.request
import urllib.error
import zipfile
import os
import time

# Variables and constants
sitesList = []

# Temporary file containing the `git diff` between master and stable
tmpRulesFileName = "/tmp/rulesDiff-" + format(random.randrange(1,65535)) # Feel free to enlarge if needed

# URL of the Alexa Top1M
alexaTop1MURL = "http://s3.amazonaws.com/alexa-static/top-1m.csv.zip"
# alexaTop1MURL = "http://127.0.0.1/top-1m.csv.zip"

# Temporary file name, to aboid conflicts
tmpAlexaFileName = "/tmp/alexa-top1M-" + format(random.randrange(1,65535)) + ".csv"

# Logfile. Records the same output as the script (FOUND and "File not found" messages)
logFileName = "/tmp/alexa-ruleset-log-" + format(random.randrange(1,65535)) + ".log"

# Filename of the CSV file contained in the Alexa zipfile
tmpAlexaZipFileContents = 'top-1m.csv' 

# Absolute path of the git repo (the folder containing src/)
# Remember to change this accordingly to your system, if you ever move the script
#
# By default, it refers to the parent directory of the one containing the script
# because the script was put in utils/
#
# __NEEDS A TRAILING SLASH__
#
# gitRepositoryPath = os.path.abspath(os.path.join(os.curdir, os.pardir))
gitRepositoryPath = os.path.abspath(os.path.join(os.curdir, os.pardir)) + "/"


# Functions
def ruleLookup(target):
    try: # list.index(value) throus an exception for a "not found", so if it throws it, it's not found
        sitesList.index(target)
        return 1
    except:
        return 0

# Fetch the Alexa Top 1M - http://stackoverflow.com/questions/1517616/stream-large-binary-files-with-urllib2-to-file
try:
    print("Retrieving Alexa Top1M from", alexaTop1MURL)
    tmpAlexaZipFileName, headers = urllib.request.urlretrieve(alexaTop1MURL)
    print("File downloaded and stored in %s" % tmpAlexaZipFileName)
except urllib.error.URLError as e:
    print("Failed to download Alexa Top 1M")
    sys.exit('Error message: %s' % e)

# Now unzip it
try:
    # Extract in /tmp/
    print("Start extracting %s" % tmpAlexaZipFileName)
    tmpAlexaZipFile = zipfile.ZipFile(tmpAlexaZipFileName,'r')
    tmpAlexaZipFile.extractall('/tmp/')
except zipfile.BadZipfile:
    sys.exit("The zip file %s is corrupted.",tmpAlexaZipFileName)

try:
    # Rename the file to match the file with the random in it
    os.rename('/tmp/' + tmpAlexaZipFileContents,tmpAlexaFileName)
    print("Alexa Top1M retrieved and stored in %s" % tmpAlexaFileName)
except OSError as e:
    print("Failed to rename /tmp/top-1M.csv to %s." % (tmpAlexaFileName))
    sys.exit('Error message: %s' % (e))

# Handles reading the Alexa Top 1M and pushing all sites in a list
sitesReader = csv.reader(open(tmpAlexaFileName), delimiter=',', quotechar='"')
for row in sitesReader:
    try:
        # Since some Alexa sites are not FQDNs, split where there's a "/" and keep ony the first part
        siteFQDN = sitesList.append(row[1].split("/",1)[0])
    except csv.Error as e:
            sys.exit('file %s, line %d: %s' % (tmpAlexaFileName, sitesReader.line_num, e))

# `git diff` the master revision against stable, rules folder only
try:
    print("Create git diff between master and stable in %s" % tmpRulesFileName)
    tmpRulesFile = open(tmpRulesFileName,"w")
    #subprocess.call(['git', 'diff', '--name-status', 'master..remotes/origin/stable', '../src/chrome/content/rules'], stdout=tmpRulesFile)
    subprocess.call(['git', 'diff', '--name-status', 'remotes/origin/stable..master', '../src/chrome/content/rules'], stdout=tmpRulesFile)
    tmpRulesFile.close()
except OSError as e:
    sys.exit('An OSError exception was raised: %s' % (e))

rulesList = open(tmpRulesFileName, 'r')
logFile = open(logFileName,'w')
logFile.write("Log file generated on %s.\nPaths are relative to the root directory of the git repo.\n\n"  % time.strftime("%Y-%m-%d %H:%M:%S"))

for line in rulesList:
    try:
        # Split into "file mode in commit + file path"
        ruleFile = line.split()
        found = 0
        # If file mode is "A" (add)
        if ruleFile[0] == "A": # If file was "added", parse
            ruleText = etree.parse(gitRepositoryPath + ruleFile[1]) # ADJUST FILE PATH (here is '../' IF YOU MOVE THE SCRIPT
            for target in ruleText.findall('target'):
                FQDN = target.get('host') # URL of the website
                if ruleLookup(FQDN) == 1: # Look it up in the sitesList
                    found = 1
                    break
        # If found, print it
        if found == 1:
            print("FOUND: ", ruleFile[1])
            logFile.write("FOUND: %s\n" % ruleFile[1])
        # else ignore
        # There are some problems with file name encoding. So, for now, just print an error and pass
    except FileNotFoundError as e: # Won't happen before line.split() is invoked
        print("File not found:", ruleFile[1])
#        logFile.write ("File not found: %s\n" % ruleFile[1])
        logFile.write("%s\n" % e)
        pass

# Close the rules file
rulesList.close()
# And the log file
logFile.close()
