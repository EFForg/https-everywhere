#! /usr/bin/env python

"""Creates a ruleset update JSON manifest file with the following format
{
  update: {
    "branch"         : <ruleset branch>,
    "date"           : <the date the new db was released>,
    "changes"        : <a short description of recent changes>,
    "format_version" : <ruleset database version>,
    "hash"           : <the hash of the db file>,
    "db_signature"   : <the signature of the ruleset database>,
    "source"         : <the URL serving the updated ruleset db>
  },
  "update_signature" : <the signature of the serialized update object>
}

More details about this specification can be found in the github gist:
https://gist.github.com/redwire/2e1d8377ea58e43edb40
Commentary can be read on the HTTPS Everywhere mailing list:
https://lists.eff.org/pipermail/https-everywhere/2014-May/002069.html

The following is an example of interacting with this program to build a JSON manifest.
The hash and signature values do not need to use uppercase letters, and are not real hash
or signature values.
The program outputs the serialized update object so that it can be signed.
Once all of the fields are collected, the full manifest is printed.

$ python ruleset_update_manifest.py
<type 'str'> hash: 537C641B4BBC15A542B9452D78626A4914C83DAB5844370CBC64949E6FE9C3A1
<type 'int'> format_version: not an integer
Error: not an integer could not be converted to type <type 'int'>
<type 'int'> format_version: 1
<type 'str'> db_signature: 2D2DD86DBBDCD715B86F797332B613C599BF685D8D171B908282FA90A506330F
<type 'str'> source: https://eff.org/files/https-everywhere/ruleset.db
<type 'str'> branch: stable
<type 'float'> date: May 22nd
Error: May 22nd could not be converted to type <type 'float'>
<type 'float'> date: 20140522.01
<type 'str'> changes: This is an example
Serialized JSON for "update" object:
{"hash": "537C641B4BBC15A542B9452D78626A4914C83DAB5844370CBC64949E6FE9C3A1", "format_version": 1, "db_signature":
"2D2DD86DBBDCD715B86F797332B613C599BF685D8D171B908282FA90A506330F", "source":
"https://eff.org/files/https-everywhere/ruleset.db", "branch": "stable", "date": 20140522.01, "changes": "This is an
example"}
<type 'str'> update_signature: 6C383E37B8B5997F487C3D947322142B8867CEFE6CE1EFD20FF130111CC4AF11
Serialized JSON manifest:
{"update_signature": "6C383E37B8B5997F487C3D947322142B8867CEFE6CE1EFD20FF130111CC4AF11", "update": {"hash":
"537C641B4BBC15A542B9452D78626A4914C83DAB5844370CBC64949E6FE9C3A1", "format_version": 1, "db_signature":
"2D2DD86DBBDCD715B86F797332B613C599BF685D8D171B908282FA90A506330F", "source":
"https://eff.org/files/https-everywhere/ruleset.db", "branch": "stable", "date": 20140522.01, "changes": "This is an
example"}}
"""

import json
import sys

# The lowest version of Python expected to be supported
MIN_PYTHON_VER = (2, 6) 
PYTHON_VERSION_3 = (3, 0)

# Map the field name to the expected type.
update_fields = {
  "branch" : str,
  "date" : float,
  "changes" : str,
  "format_version" : int,
  "hash" : str,
  "db_signature" : str,
  "source" : str
}

# The update field will be inserted into the main JSON object
main_fields = {
  "update_signature" : str
}

# We could use OptParse or argparse from python 2 and 3 respectively, but in order to print
# out the serialised `update` object in order to collect the signature of it while this
# program is running, we will instead collect the required data from stdin.

# Python 3's `input` returns a string the way python 2's raw_input does.
# Type checking will be done at each step regardless, so we will just use the input function
# to collect the input as a string and try to convert it.
if sys.version_info >= MIN_PYTHON_VER and sys.version_info < PYTHON_VERSION_3:
    input = raw_input
elif sys.version_info < MIN_PYTHON_VER:
    raise 'Versions of python older than %f are not supported.' %('.'.join(MIN_PYTHON_VER))

def field_entry(value, expected_type):
    """ Convert a value into its expected type """
    try:
        modified_value = expected_type(value)
        return modified_value
    except ValueError as ve:
        raise ValueError('{0} could not be converted to type {1}'.format(value, expected_type))

def retrieve_valid_input(prompt, expected_type):
    """ Prompt for input until it is provided as the correct type """
    value = None
    while not value:
        try:
            value = field_entry(input(prompt), expected_type)
        except ValueError as ve:
            print('Error: ' + ve.message)
            value = None
    return value

def main():
    """ Prompt for the fields needed to build the JSON manifest and create said manifest """
    update = {}
    main_obj = {}
    for field in update_fields.keys():
        prompt = '{0} {1}: '.format(update_fields[field], field)
        value = retrieve_valid_input(prompt, update_fields[field])
        update[field] = value
    print('Serialized JSON for "update" object:')
    print(json.dumps(update))
    for field in main_fields.keys():
        prompt = '{0} {1}: '.format(main_fields[field], field)
        value = retrieve_valid_input(prompt, main_fields[field])
        main_obj[field] = value
    main_obj['update'] = update 
    print('Serialized JSON manifest:')
    print(json.dumps(main_obj))

if __name__ == '__main__':
    main()
