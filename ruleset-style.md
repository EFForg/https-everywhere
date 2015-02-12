# Ruleset Style Guide

Goal: rules should be written in a way that is consistent, easy for humans to
read and debug, reduces the chance of errors, and makes testing easy.

To that end, here are some style guidelines for writing or modifying rulesets.
They are intended to help and simplify in places where choices are ambiguous,
but like all guidelines they can be broken if the circumstances require it.

Avoid using the left-wildcard ("&lt;target host='*.example.com'&gt;") unless you
really mean it. Many rules today specify a left-wildcard target, but the
rewrite rules only rewrite an explicit list of hostnames.

Instead, prefer listing explicit target hosts and a single rewrite from "^http:" to
"^https:". This saves you time as a ruleset author because each explicit target
host automatically creates a an implicit test URL, reducing the need to add your
own test URLs. These also make it easier for someone reading the ruleset to figure out
which subdomains are covered.

If you know all subdomains of a given domain support HTTPS, go ahead and use a
left-wildcard, along with a plain rewrite from "^http:" to "^https:". Make sure
to add a bunch of test URLs for the more important subdomains. If you're not
sure what subdomains might exist, check the 'subdomain' tab on Wolfram Alpha:
http://www.wolframalpha.com/input/?i=_YOUR_DOMAIN_GOES_HERE_.

If there are a handful of tricky subdomains, but most subdomains can handle the
plain rewrite from "^http:" to "^https:", specify the rules for the tricky
subdomains first, and then then plain rule last. Earlier rules will take
precedence, and processing stops at the first matching rule. There may be a tiny
performance hit for processing exception cases earlier in the ruleset and the
common case last, but in most cases the performance issue is trumped by readability.

Avoid regexes with long strings of subdomains, e.g. &lt;rule
from="^http://(foo|bar|baz|bananas).example.com" /&gt;. These are hard to read and
maintain, and are usually better expressed with a longer list of target hosts,
plus a plain rewrite from "^http:" to "^https:".

Prefer dashes over underscores in filenames. Dashes are easier to type.

When matching an arbitrary DNS label (a single component of a hostname), prefer
`([\w-]+)` for a single label (i.e www), or `([\w-.]+)` for multiple labels
(i.e. www.beta). Avoid more visually complicated options like `([^/:@\.]+\.)?`.

For `securecookie` tags, it's common to match any cookie name. For these, prefer
`.+` over `.*`. They are functionally equivalent, but it's nice to be
consistent.

Avoid the negative lookahead operator `?!`. This is almost always better
expressed using positive rule tags and negative exclusion tags. Some rulesets
have exclusion tags that contain negative lookahead operators, which is very
confusing.

Prefer capturing groups `(www\.)?` over non-capturing `(?:www\.)?`. The
non-capturing form adds extra line noise that makes rules harder to read.
Generally you can achieve the same effect by choosing a correspondingly higher
index for your replacement group to account for the groups you don't care about.

Here is an example ruleset today:

```
<ruleset name="WHATWG.org">
  <target host="whatwg.org" />
  <target host="*.whatwg.org" />

  <rule from="^http://((?:developers|html-differences|images|resources|\w+\.spec|wiki|www)\.)?whatwg\.org/"
    to="https://$1whatwg.org/" />

</ruleset>
```

Here is how you could rewrite it according to these style guidelines, including
test URLs:
```
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
