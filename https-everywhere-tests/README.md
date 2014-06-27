# Tests for HTTPS Everywhere

## Prerequisites
* Latest release of the Firefox Add-On SDK: https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation

## Instructions
### First time
1. Create a clean Firefox profile and install HTTPS Everywhere.
2. Copy the profile to `./test_profile` (TODO: make this configurable).

### Every time
1. Activate the Add-on SDK.
2. cd to your HTTPS Everywhere repository root and run `./test.sh`.

To add tests, put them in `./https-everywhere-tests/tests`.
