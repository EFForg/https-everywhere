#! /usr/bin/env python

"""Creates a ruleset update JSON manifest file with the following format
{
  update: {
    "branch"         : <ruleset branch>,
    "date"           : <the date the new db was released>,
    "changes"        : <a short description of recent changes>,
    "format_version" : <ruleset database version>,
    "hash"           : <the hash of the db file>,
    "source"         : <the URL serving the updated ruleset db>
  },
  "update_signature" : <the signature of the serialized update object>
}

More details about this specification can be found in the github gist:
https://gist.github.com/redwire/2e1d8377ea58e43edb40
Commentary can be read on the HTTPS Everywhere mailing list:
https://lists.eff.org/pipermail/https-everywhere/2014-May/002069.html
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
