#!/usr/bin/env bash

set -o errexit

./makexpi.sh uncommitted
firefox pkg/https-everywhere-0.9.9.observatory.5~pre.xpi
