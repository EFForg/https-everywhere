#!/bin/sh
#
# BSD and GNU mktemp have slightly different invocation patterns.
# BSD's needs a -t option specifying a "template." 'everywhere' will
# end up in the temp-folder name, so in the event it doesn't get cleaned
# up, there's some indication of where it originated.

MKTEMP=`which mktemp`
function mktemp() {
    $MKTEMP $@ 2>/dev/null || $MKTEMP -t everywhere $@
}
