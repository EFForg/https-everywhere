# Ruleset coverage requirements

We have an automated tester that checks URLs for all rulesets to ensure they
still work. In order for that tester to work we need input URLs. We have
additional testing in place to ensure that all rulesets have a sufficient number
of test URLs to test them thoroughly.

Goal: 100% coverage of all targets and all branches of all regexes in each
ruleset.

Each ruleset has a number of "implicit" test URLs based on the target hosts. For
each target host e.g. `example.com`, there is an implicit test URL of
`http://example.com/`. Exception: target hosts that contain a wildcard ("`*`")
do not create an implicit test URL.

Additional test URLs can be added with the new `<test>` tag in the XML, e.g.
`<test url="http://example.com/complex-page" />`.

Test URLs will be matched against the regexes in each `<rule>` and
`<exclusion>`. A test URL can only match against one `<rule>` and one
`<exclusion>`. Once all the test URLs have been matched up, we count the number
of test URLs matching each `<rule>` and each `<exclusion>`, and make sure the
count meets the minimum number.  The minimum number of test URLs for each
`<rule>` or `<exclusion>` is one plus the number of '`*`', '`+`', '`?`', or
'`|`' characters in the regex. Since each of these characters increases the
complexity of the regex (usually increasing the variety of URLs it can match),
we require correspondingly more test URLs to ensure good coverage.

# Example:
```xml
<ruleset name="example.com">
	<target host="example.com" />
	<target host="*.example.com" />

	<test url="http://www.example.com/" />
	<test url="http://beta.example.com/" />

	<rule from="^http://([\w-]+\.)?example\.com/"
		to="https://$1example.com/" />
</ruleset>
```
This ruleset has one implicit test URL from a target host
("`http://example.com/`"). The other target host has a wildcard, so creates no
implicit test URL. There's a single rule. That rule contains a '`+`' and a
'`?`', so it requires a total of three matching test URLs. We add the necessary
test URLs using explicit `<test>` tags.

# Testing and Continuous Build

Testing for ruleset coverage is now part of the Travis CI continuous build.
Currently we only test rulesets that have been modified since February 2 2015.
Submitting changes to any ruleset that does not meet the coverage requirements
will break the build. This means that even fixes of existing rules may require
additional work to bring them up to snuff.

To run the tests locally, you'll need the https-everywhere-checker, which is now
a submodule of https-everywhere. To set it up, run:

    ./install-dev-dependencies.sh

To test a specific ruleset:

    ./fetch-test.sh rules/Example.xml
