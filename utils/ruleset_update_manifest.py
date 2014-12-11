#! /usr/bin/env python

"""Creates a ruleset update JSON manifest file according to the format
specified in https-everywhere/doc/updateJSONSpec.md
Commentary can be read on the HTTPS Everywhere mailing list:
https://lists.eff.org/pipermail/https-everywhere/2014-May/002069.html
"""

import hashlib
import time
import json
import sys
import re

# The lowest version of Python expected to be supported
MIN_PYTHON_VER = (2, 6) 
PYTHON_VERSION_3 = (3, 0)

# The time format for the date field
TIME_FORMAT = "%d-%m-%Y" # dd-mm-yyyy

# A dictionary mapping the names of hash functions supported by both
# Python's hashlib and the Gecko XPCOM interface nsICryptoHash.
HASH_FUNCTIONS = {
    "md5" : hashlib.md5,
    "sha1" : hashlib.sha1,
    "sha256" : hashlib.sha256,
    "sha384" : hashlib.sha384,
    "sha512" : hashlib.sha512
}

# Dictionary of field names for the JSON object to build that need to be
# supplied by a human. Maps the field name to a short description.
UPDATE_FIELDS = {
    "branch": "the ruleset branch",
    "changes": "a short description of recent changes",
    "version": "a subversion of the target extension",
    "source": "a valid eff.org URL pointing to the database file",
    "hashfn": "the hash function to use (md5/sha1/sha256/sha384/sha512)"
}

# Python 3's `input` returns a string the way python 2's raw_input does.
# Type checking will be done at each step regardless, so we will just use the input function
# to collect the input as a string and try to convert it.
if sys.version_info >= MIN_PYTHON_VER and sys.version_info < PYTHON_VERSION_3:
    input = raw_input
elif sys.version_info < MIN_PYTHON_VER:
    raise 'Versions of python older than %s are not supported.' %('.'.join(MIN_PYTHON_VER))

def hex_str(data):
    """ Convert data into a hex string """
    pad = lambda c: ('0' + c) if len(str(c)) == 1 else c
    return ''.join([pad(hex(ord(char))[2:]) for char in data])

def formatted_time():
    """ Return the date in a nice, human-readable format """
    return time.strftime(TIME_FORMAT, time.gmtime())

def valid_eff_url(updateObj):
    """ Make sure the supplied source points to an eff.org URL """
    # This regex works the same way in Javascript.
    regex = "^https:\/\/(www\.)?eff\.org\/[\w\-_\/]+\.sqlite$"
    matched = re.match(regex, updateObj['source']) is not None
    if not matched:
        print("### Source is not a valid eff.org URL")
    return matched

def valid_branch_name(updateObj):
    """ Test to make sure the branch name is recognized """
    valid_branches = ["development", "stable"]
    matched = any([updateObj['branch'] == branch for branch in valid_branches])
    if not matched:
        print("### Branch is neither of " + '/'.join(valid_branches))
    return matched

def valid_hash_function(updateObj):
    """ Test to make sure the hash function is supported """
    matched = updateObj['hashfn'] in HASH_FUNCTIONS.keys()
    if not matched:
        print("### " + updateObj['hashfn'] + " is not a supported hash function.")
    return matched

# A list of sanity-testing functions used to verify that the values provided to
# build the update object with make sense.
SANITY_CHECKS = [valid_eff_url, valid_branch_name, valid_hash_function]

update = {}
print("Please supply the necessary fields to build update.json")
for field in UPDATE_FIELDS.keys():
    update[field] = input(field + ', ' + UPDATE_FIELDS[field] + ": ")
update['date'] = formatted_time()
update['hash'] = None
done = not all(map(lambda test: test(update), SANITY_CHECKS))
if done: # Any test failed
    print("Since one or more of the sanity checks failed, the JSON data will not be written.")
    sys.exit(1)
hash_fn = HASH_FUNCTIONS[update['hashfn']]
while update['hash'] is None:
    dbfile_path = input("Enter the path to the database file on disk: ")
    try:
        hashed_data = hash_fn(open(dbfile_path, 'r').read()).digest()
        update['hash'] = hex_str(hashed_data)
    except IOError:
        print("Could not compute the hash of the contents of " + dbfile_path)
        update['hash'] = None 
while not done:
    file_name = input("Where should the JSON contents be stored? ")
    try:
        json_data = json.dumps(update, sort_keys=True).replace(', ', '\n,')
        open(file_name, 'w').write(json_data + '\n')
        print("The update contents have been successfully written.")
        done = True
    except IOError:
        print("Could not open " + file_name + " for writing.")
    except TypeError:
        print("Something really strange happened and the update data could not be serialized!")
        print("Please get in touch with a maintainer of HTTPS-Everywhere to have the issue investigated.")
        done = True # Lie, because breaking out of (otherwise infinite) while loops isn't "pythonic"
print("Exiting...")
