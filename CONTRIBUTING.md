# Welcome!

Welcome, and thank you for your interest in contributing to HTTPS Everywhere! HTTPS Everywhere depends on the open source community for its continued success, so any contribution is appreciated.

One of the things that makes it easy to contribute to HTTPS Everywhere is that you don't have to be a coder to contribute. That's because HTTPS Everywhere's most important component is the list of rules that tell it when it can request a website over HTTPS. These rules are just XML files that contain regular expressions, so if you can write XML and simple regexes, you can help us add rules and increase HTTPS Everywhere's coverage. No coding skills necessary!

If you want to have the greatest impact, however, you can help be a ruleset maintainer. Ruleset maintainers are trusted volunteers who examine rulesets contributed by others and work with them to ensure that these rulesets work properly and are styled correctly before they're merged in. While we currently have a couple of extremely dedicated and extremely proficient ruleset maintainers, the backlog of sites to add to HTTPS Everywhere just keeps growing, and they need help! If you would like to volunteer to become one, the best thing to do is to build trust in your work by monitoring the repository, contributing pull requests, and commenting on issues that interest you. Then you can contact us at https-everywhere-rules-owner [at] eff &lt;dot&gt; org expressing your interest in helping out.

If you get stuck we have two publicly-archived mailing lists: the https-everywhere list (https://lists.eff.org/mailman/listinfo/https-everywhere) is for discussing the project as a whole, and the https-everywhere-rulesets list (https://lists.eff.org/mailman/listinfo/https-everywhere-rules) is for discussing the `rulesets` and their contents, including patches and git pull requests.

You can also find more information on about HTTPS Everywhere on our [FAQ](https://www.eff.org/https-everywhere/faq) page.

Thanks again, and we look forward to your contributions!


## HTTPS Everywhere Source Code Layout

There are several main areas of development on HTTPS Everywhere: the rulesets, the core codebase, utilities, and tests.

The rulesets can be found in the [`rules`](rules) top-level path and include all the rules for redirecting individual sites to HTTPS.  These are written in XML. If you want to get started contributing to HTTPS Everywhere, we recommend starting here.

The core codebase consists of the code that performs the redirects, the UI, logging code, and ruleset loading.  This encompasses all code delivered with the extension itself that is *not* a ruleset.  It is written in JavaScript, using the `WebExtensions` API (located in [`chromium`](chromium)) on all supported browsers.  In Firefox, this extension is wrapped in a thin `XPCOM` layer for the purposes of migrating settings, located in [`src`](src), which will soon be deprecated.

The utilities ([`utils`](utils) top-level path) include scripts that build the extension, sanitize and perform normalization on rulesets, simplify rules, and help label GitHub issues.  Historically, these utilities have been written in Python.  Many of the newer utilities are written in JavaScript, and are meant to be run in node.  Some of the wrappers for these utilities are in shell scripts.

Tests are performed in headless browsers and located in the [`test`](test) top-level path.  These are written in Python, and some of the wrappers for these tests are in shell scripts.

## Submitting Changes

To submit changes, open a pull request from our [GitHub repository](https://github.com/efforg/https-everywhere).

HTTPS Everywhere is maintained by a limited set of staff and volunteers.  Please be mindful that we may take a while before we're able to review your contributions.

* * *

# Contributing Rulesets

## General Info

Thanks for your interest in contributing to the HTTPS Everywhere `rulesets`! There's just a few things you should know before jumping in. First some terminology, which will help you understand how exactly `rulesets` are structured and what each one contains:

- `ruleset`: a scope in which `rules`, `targets`, and `tests` are contained. `rulesets` are usually named after the entity which controls the group of `targets` contained in it.  There is one `ruleset` per XML file within the `src/chrome/content/rules` directory.
- `target`: a Fully Qualified Domain Name which may include a wildcard specified by `*.` on the left side, which `rules` are applied to. There may be many `targets` within any given `ruleset`.
- `rule`: a specific regular expression rewrite that is applied for all matching `targets` within the same `ruleset`.  There may be many `rules` within any given `ruleset`.
- `test`: a URL for which a request is made to ensure that the rewrite is working properly.  There may be many `tests` within any given `ruleset`.

```xml
<!--
        An example ruleset. Note that this example doesn't necessarily
        satisfy the style criteria described below - we just have it
        here to show you what the components of a ruleset looks like.
-->
<ruleset name="eff.org">
        <target host="*.eff.org" />

        <rule from="^http:" to="https:" />

        <test url="http://www.eff.org/https-everywhere/" />
</ruleset>
```

HTTPS Everywhere includes tens of thousands of `rulesets`.  Any one of these sites can change their HTTPS configuration at any time, so keeping HTTPS Everywhere usable is a task that requires constant maintenance.  At the same time, HTTPS deployment on the web is becoming more and more widespread, thanks to projects like [Let's Encrypt](https://letsencrypt.org/).  This is a very good thing, as it means the web is becoming a safer place!  However, with each new `ruleset` that HTTPS Everywhere includes comes with an increase in both download size upon install and memory usage at runtime.  Rather than adding new `rulesets`, we encourage potential contributors to look for broken `rulesets` and try to fix them first.

Some `rulesets` have the attribute `platform="mixedcontent"`.  These `rulesets` cause problems in browsers that enable active mixed-content (loading insecure resources in a secure page) blocking.  When browsers started enforcing active mixed-content blocking, some HTTPS sites started to break.  That's why we introduced this tag - it disables those `rulesets` for browsers blocking active mixed content.  It is likely that many of these sites have fixed this historical problem, so we particularly encourage `ruleset` contributors to fix these `rulesets` first:

    git grep -i mixedcontent src/chrome/content/rules

## New Rulesets

If you want to create new `rulesets` to submit to us, we expect them to be in the `src/chrome/content/rules` directory. That directory also contains a useful script, `make-trivial-rule`, to create a simple `ruleset` for a specified domain. There is also a script called `utils/trivial-validate.py`, to check all the pending `rulesets` for several common errors and oversights. For example, if you wanted to make a `ruleset` for the `example.com` domain, you could run:
```
cd src/chrome/content/rules
bash ./make-trivial-rule example.com
```
This would create `Example.com.xml`, which you could then take a look at and edit based on your knowledge of any specific URLs at `example.com` that do or don't work in HTTPS. Please have a look at our Ruleset Style Guide below, where you can find useful tips about finding more subdomains. Our goal is to have as many subdomains covered as we can find.

## Minimum Requirements for a Ruleset PR

There are several volunteers to HTTPS Everywhere who have graciously dedicated their time to look at the `ruleset` contributions and work with contributors to ensure quality of the pull requests before merging.  It is typical for there to be several back-and-forth communications with these `ruleset` maintainers before a PR is in a good shape to merge.  Please be patient and respectful, the maintainers are donating their time for no benefit other than the satisfaction of making the web more secure.  They are under no obligation to merge your request, and may reject it if it is impossible to ensure quality.  You can identify these volunteers by looking for the "Collaborator" identifier in their comments on HTTPS Everywhere issues and pull requests.

In the back-and-fourth process of getting the `ruleset` in good shape, there may be many commits made.  It is this project's convention to squash-and-merge these commits into a single commit before merging into the project.  If your commits are cryptographically signed, we may ask you to squash the commits yourself in order to preserve this signature.  Otherwise, we may squash them ourselves before merging.

We prefer small, granular changes to the rulesets.  Not only are these easier to test and review, this results in cleaner commits.

## Testing

A general workflow for testing sites that provide both HTTP and HTTPS follows.  Open a version of the browser of your choice without HTTPS Everywhere loaded to the HTTP endpoint, alongside the browser with the latest code and rulesets for HTTPS Everywhere loaded to the HTTPS endpoint (as described in [README.md](README.md).)  Click around and compare the look and functionality of both sites.

If something fails to load or looks strange, you may be able to debug the problem by opening the network tab of your browser debugging tool.  Modify the `ruleset` until you get it in a good state - you'll have to re-run the HTTPS Everywhere-equipped browser upon each change.

## Ruleset Style Guide

### Motivation

Rules should be written in a way that is consistent, easy for humans to read and debug, reduces the chance of errors, and makes testing easy.

To that end here are some style guidelines for writing or modifying rulesets. They are intended to help and simplify in places where choices are ambiguous, but like all guidelines they can be broken if the circumstances require it.

### Indentation & Misc Stylistic Conventions

Use tabs for indentation.  For `tests` and `exclusions`, place them under the `target` that they refer to, indented one additional layer.  See below for an example.

We provide an [`.editorconfig`](.editorconfig) file in the top-level path, which you can configure your editor of choice to use.  This will enforce proper indentation.

Use double quotes (`"`, not `'`).

### Wildcards in Targets

#### Left-Wildcards

Avoid using the left-wildcard (`<target host='*.example.com' />`) unless you intend to rewrite all or nearly all subdomains.  If it can be demonstrated that there is comprehensive HTTPS coverage for subdomains, left-wildcards may be appropriate.  Many rules today specify a left-wildcard target, but the rewrite rules only rewrite an explicit list of hostnames.

Instead, prefer listing explicit target hosts and a single rewrite from `"^http:"` to `"^https:"`. This saves you time as a ruleset author because each explicit target host automatically creates an implicit test URL, reducing the need to add your own test URLs. These also make it easier for someone reading the ruleset to figure out which subdomains are covered.

If you know all subdomains of a given domain support HTTPS, go ahead and use a left-wildcard, along with a plain rewrite from `"^http:"` to `"^https:"`. Make sure to add a bunch of test URLs for the more important subdomains. 

#### Edge-Case: Right-Wildcards

Right-wildcards (`<target host='account.google.*' />`) are highly discouraged.  Only use them in edge-cases where other solutions are unruly.

Example:

* Complicated rulesets like [`Google.tld_Subdomains.xml`](https://github.com/EFForg/https-everywhere/blob/cb03ac8418a773a309d605231a15a702fce96ce9/src/chrome/content/rules/Google.tld_Subdomains.xml)

Where they must be used, please add a comment to the `ruleset` explaining why.

### Complicated Regex in Rules

Avoid regexes with long strings of subdomains, e.g. `<rule from="^http://(foo|bar|baz|bananas).example.com" />`. These are hard to read and maintain, and are usually better expressed with a longer list of target hosts, plus a plain rewrite from `"^http:"` to `"^https:"`.

In general, avoid using open-ended regex in rules.  In certain cases, open-ended regex may be the most elegant solution.  But carefully consider if there are other options.

Examples:

* Rulesets with a lot of domains that we can catch with a simple regex that would be tedious and error-prone to list individually, like [`360.cn.xml`](https://github.com/EFForg/https-everywhere/blob/9698e64a2de7cf37509ab13ba9dcfd5bd4f84a95/src/chrome/content/rules/360.cn.xml#L98-L103)
* CDNs with an arbitrarily large number of subdomains, like https://github.com/EFForg/https-everywhere/pull/7484#issuecomment-262852427 .

### Enumerating Subdomains

If you're not sure what subdomains might exist, you can install the `Sublist3r` tool:

    git clone https://github.com/aboul3la/Sublist3r.git
    cd Sublist3r
    sudo pip install -r requirements.txt # or use virtualenv...

Then you can to enumerate the list of subdomains:

    python sublist3r.py -d example.com -e Baidu,Yahoo,Google,Bing,Ask,Netcraft,Virustotal,SSL

Alternatively, you can iteratively use Google queries and enumerate the list of results like such:

1. site:*.eff.org
2. site:*.eff.org -site:www.eff.org
3. site:*.eff.org -site:www.eff.org -site:ssd.eff.org

... and so on.

### Target Ordering

In all cases where there is a list of domains, sort them in alphabetical order starting from the top level domain at the right reading left, moving ^ and www to the top of their group. For example:

    example.com
    www.example.com
    a.example.com
    www.a.example.com
    b.a.example.com
    b.example.com
    example.net
    www.example.net
    a.example.net

### Rule Ordering

If there are a handful of tricky subdomains, but most subdomains can handle the plain rewrite from `"^http:"` to `"^https:"`, specify the rules for the tricky subdomains first, and then then plain rule last. Earlier rules will take precedence, and processing stops at the first matching rule. There may be a tiny performance hit for processing exception cases earlier in the ruleset and the common case last, but in most cases the performance issue is trumped by readability.

### Non-working hosts

It is useful to list hosts that do not work in the comments of a `ruleset`.  This is a stylistic preference but is not strictly required.

For easy reading, please avoid using UTF characters unless in the rare instances that they are part of the hostname itself.

Example:
```xml
<!--
        Invalid certificate:
                8marta.glavbukh.ru
                forum2.glavbukh.ru (incomplete certificate chain)

        Redirect to HTTP:
                8marta2013.glavbukh.ru
                den.glavbukh.ru

        Refused:
                e.glavbukh.ru
                www.e.glavbukh.ru

        Time out:
                psd.glavbukh.ru
                str.glavbukh.ru

-->
```

In most cases, the absence of a `2XX` or `3XX` endpoint indicates that a host should not be included in the set of `targets` and is non-working, *except* when it is clear that the site functions as intended in the absence of such an endpoint.

### Ruleset Names

For simple sites, the `ruleset` `name` attribute can be either a site description or the domain itself. For example, the [SeattleAquarium.org.xml](https://github.com/EFForg/https-everywhere/blob/30b7a0101d0bb8a492a0f089096bc162de07f778/src/chrome/content/rules/SeattleAquarium.org.xml) ruleset could have a `name` of `Seattle Aquarium`, `SeattleAquarium.org`, or `seattleaquarium.org`.

If a `ruleset` covers multiple domains, then the `ruleset` `name` should reflect the broader organization, project, or concept for what a ruleset is trying to accomplish.

Examples:

* [`Google.xml`](https://github.com/EFForg/https-everywhere/blob/5.2.10/src/chrome/content/rules/Google.xml) is just named `Google`, and
* [`Bitly.xml`](https://github.com/EFForg/https-everywhere/blob/5.2.10/src/chrome/content/rules/Bitly.xml) is named `bit.ly`, but
* [`Bitly_branded_short_domains.xml`](https://raw.githubusercontent.com/EFForg/https-everywhere/5.2.10/src/chrome/content/rules/Bitly_branded_short_domains.xml) is named `Bitly vanity domains`

#### Filenames

Filenames should vaguely resemble the `name` so that someone looking for the file based on the `name` can find it easily. Filenames that start with a capital letter are preferred.  Prefer dashes over underscores in filenames. Dashes are easier to type.

### Cross-referencing Rulesets

This sort of comment: `For other Migros coverage, see Migros.xml.` is definitely appropriate, in both directions.

### Regex Conventions

When matching an arbitrary DNS label (a single component of a hostname), prefer `([\w-]+)` for a single label (i.e. www), or `([\w.-]+)` for multiple labels (i.e. www.beta). Avoid more visually complicated options like `([^/:@\.]+\.)?`.

For `securecookie` tags, if you know that all cookies on the included targets can be secured (which in particular means that the cookies are not used by any of its non-securable subdomains), use the trivial

```xml
<securecookie host=".+" name=".+" />
```

where we prefer `.+` over `.*` and `.`. They are functionally equivalent, but it's nice to be consistent.

Avoid the negative lookahead operator `?!`. This is almost always better expressed using positive rule tags and negative exclusion tags. Some rulesets have exclusion tags that contain negative lookahead operators, which is very confusing.

Prefer capturing groups `(www\.)?` over non-capturing `(?:www\.)?`. The non-capturing form adds extra line noise that makes rules harder to read. Generally you can achieve the same effect by choosing a correspondingly higher index for your replacement group to account for the groups you don't care about.

### Snapping Redirects

Avoid snapping redirects. For instance, if https://foo.fm serves HTTPS correctly, but redirects to https://foo.com, it's tempting to rewrite foo.fm to foo.com, to save users the latency of the redirect. However, such rulesets are less obviously correct and require more scrutiny. And the redirect can go out of date and cause problems. HTTPS Everywhere rulesets should change requests the minimum amount necessary to ensure a secure connection.

### Example: Ruleset before style guidelines are applied

```xml
<ruleset name="WHATWG.org">
  <target host='whatwg.org' />
  <target host="*.whatwg.org" />

  <rule from="^http://((?:developers|html-differences|images|resources|\w+\.spec|wiki|www)\.)?whatwg\.org/"
    to="https://$1whatwg.org/" />
</ruleset>
```

### Example: Ruleset after style guidelines are applied, with test URLs

```xml
<ruleset name="WHATWG.org">
	<target host="whatwg.org" />
	<target host="www.whatwg.org" />
	<target host="developers.whatwg.org" />
	<target host="html-differences.whatwg.org" />
	<target host="images.whatwg.org" />
	<target host="resources.whatwg.org" />
	<target host="*.spec.whatwg.org" />
		<test url="http://html.spec.whatwg.org/" />
		<test url="http://fetch.spec.whatwg.org/" />
		<test url="http://xhr.spec.whatwg.org/" />
		<test url="http://dom.spec.whatwg.org/" />
	<target host="wiki.whatwg.org" />

	<rule from="^http:"
		to="https:" />
</ruleset>
```

## Removal of Rules

### Regular Rules

It should be considered a sufficient condition for removal if a contributor can demonstrate that the TLS configuration for either a specific `target` or a ruleset altogether is unstable and/or breaking, or will be unstable and/or breaking in the near future.  It is, of course, preferable that the `ruleset` be fixed rather than removed.

### HSTS Preloaded Rules

In `utils` we have a tool called `hsts-prune` which removes `targets` from rulesets if they are already contained in the [HSTS preload](https://hstspreload.org/) list for browsers that we support.  To be explicit, the script is an implementation of the following policy:

> Let `included domain` denote either a `target`, or a parent of a `target`.  Let `supported browsers` include the ESR, Dev, and Stable releases of Firefox, and the Stable release of Chromium.  If `included domain` is a parent of the `target`, the `included domain` must be present in the HSTS preload list for all `supported browsers` with the relevant flag which denotes inclusion of subdomains set to `true`.  If `included domain` is the `target` itself, it must be included the HSTS preload list for all `supported browsers`.  Additionally, if the http endpoint of the `target` exists, it must issue a 3XX redirect to the https endpoint for that target.  Additionally, the https endpoint for the `target` must deliver a `Strict-Transport-Security` header with the following directives present:
>
> - `max-age` >= 10886400
> - `includeSubDomains`
> - `preload`
>
> If all the above conditions are met, a contributor may remove the `target` from the HTTPS Everywhere rulesets.  If all targets are removed for a ruleset, the contributor is advised to remove the ruleset file itself.  The ruleset `rule` and `test` tags may need to be modified in order to pass the ruleset coverage test.

Every new pull request automatically has the `hsts-prune` utility applied to it as part of the continual integration process.  If a new PR introduces a `target` which is preloaded, it will fail the CI test suite.  See:

- `.travis.yml`
- `test/travis.sh`

* * *

# Contributing Code

In addition to `ruleset` contributions, we also encourage code contributions to HTTPS Everywhere.  There are a few considerations to keep in mind when contributing code.

Officially supported browsers:

- Firefox Stable
- Firefox ESR
- Chromium Stable

We also informally support Opera browser, but do not have tooling around testing Opera.  Firefox ESR is supported because this is what the Tor Browser, which includes HTTPS Everywhere, is built upon.  For the test commands, refer to [README.md](README.md).

The current extension maintainer is @Hainish.  You can tag him for PRs which involve the core codebase.

Several of our utilities and our full test suite is written in Python.  Eventually we would like the whole codebase to be standardized as JavaScript.  If you are so inclined, it would be helpful to rewrite the tooling and tests into JavaScript while maintaining the functionality.

* * *

# Contributing Translations

HTTPS Everywhere translations are handled through Transifex.  The easiest way to help with translations is to [create a Transifex account](https://www.transifex.com/signup/) if you don't already have one.  Then log into your account and click "Explore", then search for "Tor Project", and click on The Tor Project.  Then choose the language you plan to translate into, click on the name of that language, and then click "Join team" and "Go" to accept joining the translation team for your language.

Then, in the Tor Project resources list, find and click the link for the file

    HTTPS Everywhere - https-everywhere.dtd

and choose "Translate now" to enter the translation interface.

* * *

