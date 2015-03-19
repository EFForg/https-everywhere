#!/bin/bash
exec python2.7 https-everywhere-checker/src/https_everywhere_checker/check_rules.py https-everywhere-checker/manual.checker.config "$@"
