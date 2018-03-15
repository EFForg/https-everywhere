#!/bin/bash
# This script assists ruleset creators in ensuring that there is proper test
# coverage for their rules, and performs a network "fetch" test to alert the
# contributor of potential problems.

exec python3.6 test/rules/src/https_everywhere_checker/check_rules.py test/rules/manual.checker.config "$@"
