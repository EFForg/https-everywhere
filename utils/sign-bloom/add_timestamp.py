#!/bin/env python3
import json
import sys

def usage_and_exit():
    print("Usage: " + sys.argv[0] + " TIMESTAMP")
    sys.exit(1)

if len(sys.argv) != 2:
    usage_and_exit()

try:
    timestamp = int(sys.argv[1])
except:
    usage_and_exit()


for line in sys.stdin:
    json_line = json.loads(line)
    json_line['timestamp'] = timestamp
    print(json.dumps(json_line))
