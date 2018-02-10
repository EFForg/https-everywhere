## HTTPS Everywhere FAQ

This page answers frequently-asked questions about EFF's [HTTPS
Everywhere](https://www.eff.org/https-everywhere) project. If your question
isn't answered below, you can try the resources [listed
here](https://www.eff.org/https-everywhere/development).

*   [What if HTTPS Everywhere breaks some site that I
    use?](#what-if-https-everywhere-breaks-some-site-that-i-use)
*   [Why is HTTPS Everywhere preventing me from joining this hotel/school/other
    wireless
    network?](#why-is-https-everywhere-preventing-me-from-joining-this-hotelschoolother-wireless-network)
*   [Will there be a version of HTTPS Everywhere for IE, Safari, or some other
    browser?](#will-there-be-a-version-of-https-everywhere-for-ie-safari-or-some-other-browser)
*   [Why use a whitelist of sites that support HTTPS? Why can't you try to use
    HTTPS for every last site, and only fall back to HTTP if it isn't
    available?](#why-use-a-whitelist-of-sites-that-support-https-why-cant-you-try-to-use-https-for-every-last-site-and-only-fall-back-to-http-if-it-isnt-available)
*   [How do I get rid of/move the HTTPS Everywhere button in the
    toolbar?](#how-do-i-get-rid-ofmove-the-https-everywhere-button-in-the-toolbar)
*   [When does HTTPS Everywhere protect me? When does it not protect
    me?](#when-does-https-everywhere-protect-me-when-does-it-not-protect-me)
*   [What does HTTPS Everywhere protect me
    against?](#what-does-https-everywhere-protect-me-against)
*   [How do I get support for an additional site in HTTPS
    Everywhere?](#how-do-i-get-support-for-an-additional-site-in-https-everywhere)
*   [What if the site doesn't support HTTPS, or only supports it for some
    activities, like entering credit card
    information?](#what-if-the-site-doesnt-support-https-or-only-supports-it-for-some-activities-like-entering-credit-card-information)
*   [Isn't it more expensive or slower for a site to support HTTPS compared to
    regular
    HTTP?](#isnt-it-more-expensive-or-slower-for-a-site-to-support-https-compared-to-regular-http)
*   [Why should I use HTTPS Everywhere instead of just typing https:// at the
    beginning of site
    names?](#why-should-i-use-https-everywhere-instead-of-just-typing-https-at-the-beginning-of-site-names)
*   [Why does HTTPS Everywhere include rules for sites like PayPal that already
    require HTTPS on all their
    pages?](#why-does-https-everywhere-include-rules-for-sites-like-paypal-that-already-require-https-on-all-their-pages)
*   [What do the different colors for rulesets in the Firefox toolbar menu
    mean?](#what-do-the-different-colors-for-rulesets-in-the-firefox-toolbar-menu-mean)
*   [What do the different colors of the HTTPS Everywhere icon
    mean?](#what-do-the-different-colors-of-the-https-everywhere-icon-mean)
*   [I'm having a problem installing the browser
    extension.](#im-having-a-problem-installing-the-browser-extension.)
*   [How do I uninstall/remove HTTPS
    Everywhere?](#how-do-i-uninstallremove-https-everywhere)
*   [How do I add my own site to HTTPS
    Everywhere?](#how-do-i-add-my-own-site-to-https-everywhere)
*   [Can I help translate HTTPS Everywhere into my own
    language?](#can-i-help-translate-https-everywhere-into-my-own-language)

### [What if HTTPS Everywhere breaks some site that I use?](#what-if-https-everywhere-breaks-some-site-that-i-use)

This is occasionally possible because of inconsistent support for HTTPS on
sites (e.g., when a site seems to support HTTPS access but makes a few,
unpredictable, parts of the site unavailable in HTTPS). If you [report the
problem to us](https://github.com/EFForg/https-everywhere/issues), we can try
to fix it. In the meantime, you can disable the rule affecting that particular
site in your own copy of HTTPS Everywhere by clicking on the HTTPS Everywhere
toolbar button and unchecking the rule for that site.

You can also report the problem to the site, since they have the power to fix
it!

### [Why is HTTPS Everywhere preventing me from joining this hotel/school/other wireless network?](#why-is-https-everywhere-preventing-me-from-joining-this-hotelschoolother-wireless-network)

Some wireless networks hijack your HTTP connections when you first join them,
in order to demand authentication or simply to try to make you agree to terms
of use. HTTPS pages are protected against this type of hijacking, which is as
it should be. If you go to a website that isn't protected by HTTPS Everywhere
or by HSTS (currently, example.com is one such site), that will allow your
connection to be captured and redirected to the authentication or terms of use
page.

### [Will there be a version of HTTPS Everywhere for IE, Safari, or some other browser?](#will-there-be-a-version-of-https-everywhere-for-ie-safari-or-some-other-browser)

As of early 2012, the Safari extension API does not offer a way to perform
secure rewriting of http requests to https. But if you happen to know a way to
perform secure request rewriting in these browsers, feel free to let us know at
https-everywhere at EFF.org (but note that modifying document.location or
window.location in JavaScript is not secure).

### [Why use a whitelist of sites that support HTTPS? Why can't you try to use HTTPS for every last site, and only fall back to HTTP if it isn't available?](#why-use-a-whitelist-of-sites-that-support-https-why-cant-you-try-to-use-https-for-every-last-site-and-only-fall-back-to-http-if-it-isnt-available)

There are several problems with the idea of trying to automatically detect
HTTPS on every site. There is no guarantee that sites are going to give the
same response via HTTPS that they give via HTTP. Also, it's not possible to
test for HTTPS in real time without introducing security vulnerabilities (What
should the extension do if the HTTPS connection attempt fails? Falling back to
insecure HTTP isn't safe). And in some cases, HTTPS Everywhere has to perform
quite complicated transformations on URIs — for example until recently the
Wikipedia rule had to turn an address like
`http://en.wikipedia.org/wiki/World_Wide_Web` into one like
`https://secure.wikimedia.org/wikipedia/en/wiki/World_Wide_Web` because HTTPS
was not available on Wikipedia's usual domains.

### [How do I get rid of/move the HTTPS Everywhere button in the toolbar?](#how-do-i-get-rid-ofmove-the-https-everywhere-button-in-the-toolbar)

The HTTPS Everywhere button is useful because it allows you to see, and
disable, a ruleset if it happens to be causing problems with a site. But if
you'd rather disable it, go to View->Toolbars->Customize, and drag the button
out of the toolbar into the Addons bar at the bottom of the page. Then you can
hide the Addons bar. (In theory you should be able to drag it into the tray of
available icons too, but that may trigger [this
bug](https://trac.torproject.org/projects/tor/ticket/6276).

### [When does HTTPS Everywhere protect me? When does it not protect me?](#when-does-https-everywhere-protect-me-when-does-it-not-protect-me)

HTTPS Everywhere protects you only when you are using _encrypted portions of
supported web sites_. On a supported site, it will automatically activate HTTPS
encryption for all known supported parts of the site (for some sites, this
might be only a portion of the entire site). For example, if your web mail
provider does not support HTTPS at all, HTTPS Everywhere can't make your access
to your web mail secure. Similarly, if a site allows HTTPS for text but not
images, someone might be able to see which images your browser loads and guess
what you're accessing.

HTTPS Everywhere depends entirely on the security features of the individual
web sites that you use; it _activates_ those security features, but it can't
_create_ them if they don't already exist. If you use a site not supported by
HTTPS Everywhere or a site that provides some information in an insecure way,
HTTPS Everywhere can't provide additional protection for your use of that site.
Please remember to check that a particular site's security is working to the
level you expect before sending or receiving confidential information,
including passwords.

One way to determine what level of protection you're getting when using a
particular site is to use a packet-sniffing tool like
[Wireshark](https://www.wireshark.org/) to record your own communications with
the site. The resulting view of your communications is about the same as what
an eavesdropper on your wifi network or at your ISP would see. This way, you
can determine whether some or all of your communications would be protected;
however, it may be quite time-consuming to make sense of the Wireshark output
with enough care to get a definitive answer.

You can also turn on the "Block all HTTP requests" feature for added
protection. Instead of loading insecure pages or images, HTTPS Everywhere will
block them outright.

### [What does HTTPS Everywhere protect me against?](#what-does-https-everywhere-protect-me-against)

On supported parts of supported sites, HTTPS Everywhere enables the sites'
HTTPS protection which can protect you against eavesdropping and tampering with
the contents of the site or with the information you send to the site. Ideally,
this provides some protection against an attacker learning the content of the
information flowing in each direction — for instance, the text of e-mail
messages you send or receive through a webmail site, the products you browse or
purchase on an e-commerce site, or the particular articles you read on a
reference site.

However, HTTPS Everywhere **does not conceal the identities of the sites you
access**, the amount of time you spend using them, or the amount of information
you upload or download from a particular site. For example, if you access
`http://www.eff.org/issues/nsa-spying` and HTTPS Everywhere rewrites it to
`https://www.eff.org/issues/nsa-spying`, an eavesdropper can still trivially
recognize that you are accessing www.eff.org (but might not know which issue
you are reading about). In general, the entire hostname part of the URL remains
exposed to the eavesdropper because this must be sent repeatedly in unencrypted
form while setting up the connection. Another way of saying this is that HTTPS
was never designed to conceal the identity of the sites that you visit.

Researchers have also shown that it may be possible for someone to figure out
more about what you're doing on a site merely through careful observation of
the amount of data you upload and download, or the timing patterns of your use
of the site. A simple example is that if the site only has one page of a
certain total size, anyone downloading exactly that much data from the site is
probably accessing that page.

If you want to protect yourself against monitoring of the sites you visit,
consider using HTTPS Everywhere together with software like
[Tor](https://www.torproject.org/).

### [How do I get support for an additional site in HTTPS Everywhere?](#how-do-i-get-support-for-an-additional-site-in-https-everywhere)

You can learn [how to write
rules](https://www.eff.org/https-everywhere/rulesets) that teach HTTPS
Everywhere to support new sites. You can install these rules in your own
browser or send them to us for possible inclusion in the official version.

### [What if the site doesn't support HTTPS, or only supports it for some activities, like entering credit card information?](#what-if-the-site-doesnt-support-https-or-only-supports-it-for-some-activities-like-entering-credit-card-information)

You could try to contact the site and point out that using HTTPS for all site
features is an increasingly common practice nowadays and protects users (and
sites) against a variety of Internet attacks. For instance, it defends against
the ability of other people on a wifi network to spy on your use of the site or
even take over your account. You can also point out that credit card numbers
aren't the only information you consider private or sensitive.

Sites like Google, Twitter, and Facebook now support HTTPS for non-financial
information — for general privacy and security reasons.

### [Isn't it more expensive or slower for a site to support HTTPS compared to regular HTTP?](#isnt-it-more-expensive-or-slower-for-a-site-to-support-https-compared-to-regular-http)

It can be, but some sites have been pleasantly surprised to see how practical
it can be. Also, experts at Google are currently implementing several
enhancements to the TLS protocol that make HTTPS dramatically faster; if these
enhancements are added to the standard soon, the speed gap between the two
should almost disappear. See [Adam Langley's description of the HTTPS
deployment
situation](https://www.imperialviolet.org/2010/06/25/overclocking-ssl.html) for
more details on these issues. Notably, Langley states: "In order to [enable
HTTPS by default for Gmail] we had to deploy no additional machines and no
special hardware. On our production frontend machines, SSL/TLS accounts for
less than 1% of the CPU load, less than 10KB of memory per connection and less
than 2% of network overhead."

It used to be expensive to purchase a certificate for HTTPS usage, but they can
now be obtained for free from [Let's Encrypt](https://letsencrypt.org/) as
well.

### [Why should I use HTTPS Everywhere instead of just typing https:// at the beginning of site names?](#why-should-i-use-https-everywhere-instead-of-just-typing-https-at-the-beginning-of-site-names)

Even if you normally type https://, HTTPS Everywhere might protect you if you
occasionally forget. Also, it can rewrite other people's links that you follow.
For instance, if you click on a link to
`http://en.wikipedia.org/wiki/EFF_Pioneer_Award`, HTTPS Everywhere will
automatically rewrite the link to
`https://en.wikimedia.org/wikipedia/en/wiki/EFF_Pioneer_Award`. Thus, you might
get some protection even if you wouldn't have noticed that the target site is
available in HTTPS.

### [Why does HTTPS Everywhere include rules for sites like PayPal that already require HTTPS on all their pages?](#why-does-https-everywhere-include-rules-for-sites-like-paypal-that-already-require-https-on-all-their-pages)

HTTPS Everywhere, like the [HSTS
spec](https://en.wikipedia.org/wiki/HTTP_Strict_Transport_Security), tries to
address an attack called [SSL stripping](https://moxie.org/software/sslstrip/).
Users are only protected against the SSL stripping attack if their browsers
don't even _try_ to connect to the HTTP version of the site — even if the site
would have redirected them to the HTTPS version. With HTTPS Everywhere, the
browser won't even attempt the insecure HTTP connection, even if that's what
you ask it to do. (Note that HTTPS Everywhere currently does not include a
comprehensive list of such sites, which are mainly financial institutions.)

### [What do the different colors for rulesets in the Firefox toolbar menu mean?](#what-do-the-different-colors-for-rulesets-in-the-firefox-toolbar-menu-mean)

The colors are:

Dark Green: ruleset was active in loading the resources in the current page.

Light Green: ruleset was ready to prevent HTTP loads in the current page, but
everything that the ruleset would have covered was loaded over HTTPS anyway (in
the code, light green is called a "moot rule").

Dark Brown or Clockwise Red Arrow: broken rule -- the ruleset is active but the
server is redirecting at least some URLs back from HTTPS to HTTP.

Gray: the ruleset is disabled.

### [What do the different colors of the HTTPS Everywhere icon mean?](#what-do-the-different-colors-of-the-https-everywhere-icon-mean)

The colors are:

Light Blue: HTTPS Everywhere is enabled.

Dark Blue: HTTPS Everywhere is both enabled and active in loading resources in
the current page.

Red: All unencrypted requests will be blocked by HTTPS Everywhere.

Gray: HTTPS Everywhere is disabled.

### [I'm having a problem installing the browser extension.](#im-having-a-problem-installing-the-browser-extension.)

Some people report that installing HTTPS Everywhere gives them the error: "The
addon could not be downloaded because of a connection failure on www.eff.org."
This may be caused by Avast anti-virus, which blocks installation of browser
extensions. You may be able to [install from addons.mozilla.org
instead](https://addons.mozilla.org/en-US/firefox/addon/https-everywhere/).

### [How do I uninstall/remove HTTPS Everywhere?](#how-do-i-uninstallremove-https-everywhere)

In Firefox: Click the menu button in the top right of the window at the end of
the toolbar (it looks like three horizontal lines), and then click "Add-ons"
(it looks like a puzzle piece). Scroll until you see HTTPS Everywhere, and then
click the "Remove" button all the way on the right. You can then safely close
the Add-ons tab.

In Chrome: Click the menu button in the top right of the window at the end of
the toolbar (it looks like three horizontal lines), and then click "Settings"
near the bottom. On the left, click "Extensions". Scroll until you see HTTPS
Everywhere, and then click the trash can icon on the right, and then click
"Remove" to confirm removal. You can then safely close the Settings tab.

### [How do I add my own site to HTTPS Everywhere?](#how-do-i-add-my-own-site-to-https-everywhere)

We're excited that you want your site in HTTPS Everywhere! However, remember
that not everyone who visits your site has our extension installed. If you run
a web site, you can make it default to HTTPS for everyone, not just HTTPS
Everywhere users. And it's less work! The steps you should take, in order, are:

1.  Set up a
    [redirect](https://www.sslshopper.com/apache-redirect-http-to-https.html)
    from HTTP to HTTPS on your site.
2.  [Add the Strict-Transport-Security (HSTS) header on your
    site.](https://raymii.org/s/tutorials/HTTP_Strict_Transport_Security_for_Apache_NGINX_and_Lighttpd.html)
3.  [Add your site to the HSTS Preload list.](https://hstspreload.appspot.com/)

These steps will give your site much better protection than adding it to HTTPS
Everywhere. Generally speaking, once you are done, there is no need to add your
site to HTTPS Everywhere. However, if you would still like to, please follow
the [instructions on writing
rulesets](https://eff.org/https-everywhere/rulesets), and indicate that you are
the author of the web site when you submit your pull request.

### [Can I help translate HTTPS Everywhere into my own language? ](#can-i-help-translate-https-everywhere-into-my-own-language)

Yes! We use the Tor Project's Transifex account for translations, please sign
up to help translate at
[https://www.transifex.com/otf/torproject](https://www.transifex.com/otf/torproject).
