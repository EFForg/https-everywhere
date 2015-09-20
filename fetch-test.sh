#!/bin/bash
exec python2.7 test/rules/src/https_everywhere_checker/check_rules.py test/rules/manual.checker.config "$@"
