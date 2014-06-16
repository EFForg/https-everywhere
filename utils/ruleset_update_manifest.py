#! /usr/bin/env python

"""Creates a ruleset update JSON manifest file with the following format
{
  "branch"  : <ruleset branch>,
  "date"    : <the date the new db was released>,
  "changes" : <a short description of recent changes>,
  "version" : <ruleset library version>,
  "hash"    : <the hash of the db file>,
  "source"  : <the URL serving the updated ruleset db>
}

More details about this specification can be found in the github gist:
https://gist.github.com/redwire/2e1d8377ea58e43edb40
Commentary can be read on the HTTPS Everywhere mailing list:
https://lists.eff.org/pipermail/https-everywhere/2014-May/002069.html
"""

import hashlib
import base64
import time
import json
import sys

# The lowest version of Python expected to be supported
MIN_PYTHON_VER = (2, 6) 
PYTHON_VERSION_3 = (3, 0)

# The time format for the date field
TIME_FORMAT = "%d %B, %Y" # dayNum Month, year

# The hash function used on the contents of the databse file.
# Options are: md5, sha1, sha224, sha256, sha384, and sha512.
HASH = hashlib.sha1

# Dictionary of field names for the JSON object to build that need to be
# supplied by a human. Maps the field name to a short description.
UPDATE_FIELDS = {
    "branch": "the ruleset branch",
    "changes": "a short description of recent changes",
    "version": "a subversion of the target extension",
    "source": "a valid eff.org URL pointing to the database file"
}

# Python 3's `input` returns a string the way python 2's raw_input does.
# Type checking will be done at each step regardless, so we will just use the input function
# to collect the input as a string and try to convert it.
if sys.version_info >= MIN_PYTHON_VER and sys.version_info < PYTHON_VERSION_3:
    input = raw_input
elif sys.version_info < MIN_PYTHON_VER:
    raise 'Versions of python older than %s are not supported.' %('.'.join(MIN_PYTHON_VER))

def formatted_time():
    """ Return the date in a nice, human-readable format """
    return time.strftime(TIME_FORMAT, time.gmtime())

update = {}
print("Please supply the necessary fields to build update.json")
for field in UPDATE_FIELDS.keys():
    update[field] = input(field + ', ' + UPDATE_FIELDS[field] + ": ")
update['date'] = formatted_time()
update['hash'] = None
while update['hash'] is None:
    dbfile_path = input("Enter the path to the database file on disk: ")
    try:
        hashed_data = HASH(open(dbfile_path, 'r').read()).digest()
        update['hash'] = base64.standard_b64encode(hashed_data)
    except IOError:
        print("Could not compute the hash of the contents of " + dbfile_path)
        update['hash'] = None 
data_written = False
while not data_written:
    file_name = input("Where should the JSON contents be stored? ")
    try:
        open(file_name, 'w').write(json.dumps(update))
        print("The update contents have been successfully written.")
        data_written = True
    except IOError:
        print("Could not open " + file_name + " for writing.")
    except TypeError:
        print("Something really strange happened and the update data could not be serialized!")
        print("Please get in touch with a maintainer of HTTPS-Everywhere to have the issue investigated.")
        data_written = True # Lie, because breaking out of (otherwise infinite) while loops isn't "pythonic"
print("Exiting...")
