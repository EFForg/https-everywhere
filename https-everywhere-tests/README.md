# Tests for HTTPS Everywhere

## Prerequisites
* Latest release of the Firefox Add-On SDK: https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation

## Instructions
1. Create a clean Firefox profile and install the HTTPS Everywhere XPI that you wish to test (TODO: script this).
2. Copy the profile to `/tmp/test_profile` (TODO: make this configurable).
3. Activate the Add-on SDK.
4. cd to your HTTPS Everywhere repository root and run `./test.sh`.
5. To add tests, put them in `./https-everywhere-tests/tests`.
