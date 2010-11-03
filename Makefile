#!/usr/bin/make -f

# this rule makes tag or branch targets
%:
	./makexpi.sh $@
# this makes prerelease xpis (and is the default rule)
prerelease:
	./makexpi.sh
clean:
	rm -f *.xpi

.PHONY: clean prerelease
