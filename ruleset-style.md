# Ruleset Style Guide

Goal: rules should be written in a way that is consistent, easy for humans to
read and debug, reduces the chance of errors, and makes testing easy.

To that end, here are some style guidelines for writing or modifying rulesets.
They are intended to help and simplify in places where choices are ambiguous,
but like all guidelines they can be broken if the circumstances require it.

Avoid using the left-wildcard (`<target host='*.example.com' />`) unless
you intend to rewrite all or nearly all subdomains.  Many rules today specify
a left-wildcard target, but the rewrite rules only rewrite an explicit list
of hostnames.

Instead, prefer listing explicit target hosts and a single rewrite from `"^http:"` to
`"^https:"`. This saves you time as a ruleset author because each explicit target
host automatically creates an implicit test URL, reducing the need to add your
own test URLs. These also make it easier for someone reading the ruleset to figure out
which subdomains are covered.

If you know all subdomains of a given domain support HTTPS, go ahead and use a
left-wildcard, along with a plain rewrite from `"^http:"` to `"^https:"`. Make sure
to add a bunch of test URLs for the more important subdomains. If you're not
sure what subdomains might exist, you can install the `Sublist3r` tool:

    git clone https://github.com/aboul3la/Sublist3r.git
    cd Sublist3r
    sudo pip install -r requirements.txt # or use virtualenv...

Then you can to enumerate the list of subdomains:

    python sublist3r.py -d example.com -e Baidu,Yahoo,Google,Bing,Ask,Netcraft,Virustotal,SSL

Alternatively, you can iteratively use Google queries and enumerate the list of
results like such:

1. site:*.eff.org
2. site:*.eff.org -site:www.eff.org
3. site:*.eff.org -site:www.eff.org -site:ssd.eff.org

... and so on.

If there are a handful of tricky subdomains, but most subdomains can handle the
plain rewrite from `"^http:"` to `"^https:"`, specify the rules for the tricky
subdomains first, and then then plain rule last. Earlier rules will take
precedence, and processing stops at the first matching rule. There may be a tiny
performance hit for processing exception cases earlier in the ruleset and the
common case last, but in most cases the performance issue is trumped by readability.

Avoid regexes with long strings of subdomains, e.g. `<rule
from="^http://(foo|bar|baz|bananas).example.com" />`. These are hard to read and
maintain, and are usually better expressed with a longer list of target hosts,
plus a plain rewrite from `"^http:"` to `"^https:"`.

Prefer dashes over underscores in filenames. Dashes are easier to type.

Use tabs and double quotes (`"`, not `'`).

When matching an arbitrary DNS label (a single component of a hostname), prefer
`([\w-]+)` for a single label (i.e. www), or `([\w.-]+)` for multiple labels
(i.e. www.beta). Avoid more visually complicated options like `([^/:@\.]+\.)?`.

For `securecookie` tags, if you know that all cookies on the included targets
can be secured (which in particular means that the cookies are not used by any
of its non-securable subdomains), use the trivial

```xml
<securecookie host=".+" name=".+" />
```

where we prefer `.+` over `.*` and `.`. They are functionally equivalent, but
it's nice to be consistent.

Avoid the negative lookahead operator `?!`. This is almost always better
expressed using positive rule tags and negative exclusion tags. Some rulesets
have exclusion tags that contain negative lookahead operators, which is very
confusing.

Prefer capturing groups `(www\.)?` over non-capturing `(?:www\.)?`. The
non-capturing form adds extra line noise that makes rules harder to read.
Generally you can achieve the same effect by choosing a correspondingly higher
index for your replacement group to account for the groups you don't care about.

Avoid snapping redirects. For instance, if https://foo.fm serves HTTPS
correctly, but redirects to https://foo.com, it's tempting to rewrite foo.fm to
foo.com, to save users the latency of the redirect. However, such rulesets are
less obviously correct and require more scrutiny. And the redirect can go out of
date and cause problems. HTTPS Everywhere rulesets should change requests the minimum
amount necessary to ensure a secure connection.

Here is an example ruleset pre-style guidelines:

```xml
<ruleset name="WHATWG.org">
  <target host='whatwg.org' />
  <target host="*.whatwg.org" />

  <rule from="^http://((?:developers|html-differences|images|resources|\w+\.spec|wiki|www)\.)?whatwg\.org/"
    to="https://$1whatwg.org/" />
</ruleset>
```

Here is how you could rewrite it according to these style guidelines, including
test URLs:

```xml
<ruleset name="WHATWG.org">
	<target host="whatwg.org" />
	<target host="developers.whatwg.org" />
	<target host="html-differences.whatwg.org" />
	<target host="images.whatwg.org" />
	<target host="resources.whatwg.org" />
	<target host="*.spec.whatwg.org" />
	<target host="wiki.whatwg.org" />
	<target host="www.whatwg.org" />

	<test url="http://html.spec.whatwg.org/" />
	<test url="http://fetch.spec.whatwg.org/" />
	<test url="http://xhr.spec.whatwg.org/" />
	<test url="http://dom.spec.whatwg.org/" />

	<rule from="^http:"
		to="https:" />
</ruleset>
```
