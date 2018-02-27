# How to Deploy HTTPS Correctly

By [Chris Palmer](http://noncombatant.org) and [Yan
Zhu](/about/staff/yan-zhu)

Originally published on 15 Nov 2010. Revised on 11 Dec 2013.

Internet technologists have always known that HTTP is insecure, causing
many risks to users. Because HTTP traffic is unencrypted, any data sent
over HTTP can be read and modified by anyone who has access to the
network. As revealed by the Snowden NSA surveillance documents, HTTP
traffic can also be collected and searched by government agencies
without notice to users or webmasters. Given these risks, EFF believes
that every website should support HTTPS on all pages as soon as
possible.

While HTTPS has long existed as the bare minimum for web security, some
websites have been slow to adopt it. In part, this is because correctly
and completely serving an application over HTTPS takes some care.

This article is designed to encourage and assist website operators in
implementing and improving HTTPS support. Although no precaution will
defend against all threats, supporting HTTPS will protect users from a
wide range of common attacks.

## Background

HTTPS provides three security guarantees:

1.  **Server authentication** allows users to have some confidence that
    they are talking to the true application server. Without this
    guarantee, there can be no guarantee of confidentiality or
    integrity.
2.  **Data confidentiality** means that eavesdroppers cannot understand
    the content of the communications between the user's browser and the
    web server, because the data is encrypted.
3.  **Data integrity** means that a network attacker cannot damage or
    alter the content of the communications between the user's browser
    and the web server, because they are validated with a cryptographic
    *[message authentication
    code](https://secure.wikimedia.org/wikipedia/en/wiki/Message_authentication_code)*.

**HTTP provides no security guarantees**, and applications that use it
**cannot possibly provide users any security**. When using a web
application hosted via HTTP, people have no way of knowing whether they
are talking to the true application server, nor can they be sure
attackers have not read or modified communications between the user's
computer and the server.

## Modes of Attack and Defense

However users connect to the Internet, there are a variety of people who
can attack them--whether spying on them, impersonating them, tampering
with their communications, or all three of these. The wifi network
operator can do this; any ISP in the path between client and server can
do it; anyone who can reconfigure the wifi router or another router can
do it; and often, anyone else using the same network can do it, too.

[Firesheep](http://codebutler.com/firesheep-a-day-later/) is an example
of a *passive network attack*: it eavesdrops on the contents of network
communications between browser and server, but does not re-route or
modify them. Government surveillance programs such as
[XKeyscore](http://www.theguardian.com/world/2013/jul/31/nsa-top-secret-program-online-data)
also use passive attacks on HTTP traffic to collect massive amounts of
online communication data.

By contrast, other freely-available tools perform *active network
attacks*, in which the attacker does modify the contents of and/or
re-route communications. These tools range from serious, such as
[sslstrip](http://www.thoughtcrime.org/software/sslstrip/), to silly,
like [the
Upside-Down-Ternet](http://www.ex-parrot.com/pete/upside-down-ternet.html).
Although Upside-Down-Ternet is a funny prank, it is technically
identical to potentially more damaging attacks such as an attack that
injects malicious code or incorrect information into web pages; at the
same time, it shows that such attacks are easy enough to be jokes. Free
wifi hotspots have been known to inject advertisements dynamically into
web pages that users read--indicating that active network attacks are a
viable business model. Tools like [Cain and
Abel](http://www.oxid.it/cain.html) enable a range of attacks, including
re-routing local network traffic through the attacker's system. (Also
see [Arpspoof](http://arpspoof.sourceforge.net/) and
[dsniff](http://www.monkey.org/~dugsong/dsniff/).)

Only a mechanism that provides (at least) authentication,
confidentiality, and integrity can defend against a range of attacks.
HTTPS is currently our best option for web applications.

However, there are some potential pitfalls that site operators must
avoid in order to deploy HTTPS securely.

## Mixed Content

When hosting an application over HTTPS, there can be no *mixed content*;
that is, all content in the page must be fetched via HTTPS. It is common
to see partial HTTPS support on sites, in which the main pages are
fetched via HTTPS but some or all of the media elements, stylesheets,
and JavaScript in the page are fetched via HTTP.

This is unsafe because although the main page load is protected against
active and passive network attack, none of the other resources are. If a
page loads some JavaScript or CSS code via HTTP, an attacker can provide
a false, malicious code file and take over the page's DOM once it loads.
Then, the user would be back to a situation of having no security. This
is why all mainstream browsers warn users about pages that load mixed
content. Nor is it safe to reference images via HTTP: What if the
attacker swapped the Save Message and Delete Message icons in a webmail
app?

**You must serve the entire application domain over HTTPS.** Redirect
HTTP requests with HTTP 301 or 302 responses to the equivalent HTTPS
resource.

Some site operators provide only the login page over HTTPS, on the
theory that only the user's password is sensitive. These sites' users
are [vulnerable to passive and active
attacks](/deeplinks/2010/10/message-firesheep-baaaad-websites-implement).

Unfortunately, many sites today load content from external sites and
CDN's that do not support HTTPS. If it's not possible to serve these
resources from your own host or another one that supports HTTPS, you
should urge these other sites to start supporting HTTPS immediately.

## Security and Cookies

As Chris Palmer described in a [paper on secure session management for
web
applications](https://www.isecpartners.com/files/web-session-management.pdf),
site operators must scope sensitive cookies (such as cookies used for
user authentication) to the secure origin. If a cookie is broadly scoped
(with the Domain attribute in the Set-Cookie: header), it may "leak" to
other hosts or applications in the same domain--potentially less-secure
hosts or applications.

Similarly, the application must set the Secure attribute on the cookie
when setting it. This attribute instructs the browser to send the cookie
only over secure (HTTPS) transport, never insecure (HTTP).

## Use HTTP Strict Transport Security

[HTTP Strict Transport
Security](https://en.wikipedia.org/wiki/Strict_Transport_Security)
(HSTS) is an HTTP protocol extension that enables site operators to
instruct browsers to expect the site to use HTTPS.

Although not all browsers yet support HSTS, EFF urges those that
don't--we're looking especially at you, Apple and Microsoft--to follow
the lead Google, Opera, and Mozilla have set by adopting this useful
security mechanism. Indeed, ultimately we expect HTTPS (and possibly
newer protocols such as [SPDY](https://en.wikipedia.org/wiki/SPDY) and
[QUIC](https://en.wikipedia.org/wiki/QUIC)) to replace HTTP entirely,
the way SSH replaced Telnet and rsh.

As an extra precaution, your site should support HSTS preloading, which
prevents interception of an HTTP request if the browser hasn't yet
received a valid HSTS header from the server. HSTS preloading is
implemented via an opt-in list of domains that is included in Chromium,
Google Chrome, and Firefox. See [Chromium's
page](http://www.chromium.org/sts) for instructions on getting your site
added to this list. Note that you must also send an HSTS header with a
max-age greater value than 18 weeks for Firefox to include your site in
their HSTS preload list.

We recently enabled HSTS and HSTS preloading for eff.org. It took less
than an hour to set up, and we found a way to do it without forcibly
redirecting users to HTTPS, so we can state an unequivocal preference
for HTTPS access while still making the site available in HTTP. It
worked like a charm and a significant fraction of our users are now
automatically accessing our site in HTTPS, perhaps without even knowing
it.

## Choose Strong Protocols and Cipher Suites

Here is a brief list of recommendations for choosing secure protocols
and cipher suites in an SSL deployment:

*   Disable support for SSLv2, SSLv3, and TLS 1.0.
*   Support TLS 1.1 and 1.2.
*   Disable NULL, aNULL, and eNULL ciphersuites, which do not offer both
    encryption and authentication.
*   Use private keys that are at least as secure as a 2048-bit RSA key.
*   Prefer ciphersuites that include **ephemeral Diffie-Hellman key
    exchange**. These offer the important property of [Perfect Forward
    Secrecy](https://www.eff.org/deeplinks/2013/08/pushing-perfect-forward-secrecy-important-web-privacy-protection),
    which prevents decryption of past web traffic if your SSL private
    key is compromised in the future.
*   Disable ciphersuites with keys sizes smaller than 128 bits for
    encryption.
*   Disable ciphersuites that use MD5 for hashing. SHA-1 is also
    discouraged but may be required for compatibility with TLS 1.0 and
    SSLv3.
*   Disable ciphersuites that use RC4 for encryption. AES-CBC is
    preferable to RC4 but vulnerable to the
    [BEAST](https://www.imperialviolet.org/2011/09/23/chromeandbeast.html)
    attack. Thus, AES-GCM is often recommended.
*   Disable TLS compression in order to prevent the [CRIME
    attack](https://en.wikipedia.org/wiki/CRIME_%28security_exploit%29).
*   Only support secure TLS renegotiations compliant with
    [RFC 5746](http://www.ietf.org/rfc/rfc5746.txt), or disable TLS
    renegotiations entirely.

A useful tool for testing for well-known weaknesses in an existing HTTPS
deployment is Qualys's [SSL Server
Test](https://www.ssllabs.com/ssltest/).

## Performance Concerns

Many site operators report that they can't move to HTTPS for performance
reasons. However, most people who say this have not actually measured
any performance loss, may not have measured performance at all, and have
not profiled and optimized their site's behavior. Usually, sites have
latency far higher and/or throughput far lower than necessary even when
hosting over HTTP--indicating HTTPS is not the problem.

The crux of the performance problem is usually at the content layer, and
also often at the database layer. Web applications are fundamentally
I/O-bound, after all. Consider [this wisdom from the Gmail
developers](http://gmailblog.blogspot.com/2008/05/need-for-speed-path-to-faster-loading.html):

> First, we listed every transaction between the web browser and
> Google's servers, starting with the moment the "Sign in" button is
> pressed. To do this, we used a lot of different web development tools,
> like [Httpwatch](http://httpwatch.com/),
> [WireShark](http://www.wireshark.org/), and
> [Fiddler](http://www.fiddlertool.com/fiddler/), plus our own
> performance measuring systems. \[...\]
> 
> We spent hours poring over these traces to see exactly what was
> happening between the browser and Gmail during the sign-in sequence,
> and we found that there were between fourteen and twenty-four HTTP
> requests required to load an inbox and display it. To put these
> numbers in perspective, a popular network news site's home page
> required about a 180 requests to fully load when I checked it
> yesterday. But when we examined our requests, we realized that we
> could do better. We decided to attack the problem from several
> directions at once: reduce the number of overall requests, make more
> of the requests cacheable by the browser, and reduce the overhead of
> each request.
> 
> We made good progress on every front. We reduced the weight of each
> request itself by eliminating or narrowing the scope of some of our
> cookies. We made sure that all our images were cacheable by the
> browser, and we consolidated small icon images into single
> meta-images, a technique known as spriting. We combined several
> requests into a single combined request and response. The result is
> that it now takes as few as four requests from the click of the "Sign
> in" button to the display of your inbox.

Google's [Adam Langley provides additional
detail](http://www.imperialviolet.org/2010/06/25/overclocking-ssl.html):

> In order to do this we had to deploy *no additional machines* and *no
> special hardware*. On our production frontend machines, SSL/TLS
> accounts for less than 1% of the CPU load, less than 10KB of memory
> per connection and less than 2% of network overhead. Many people
> believe that SSL takes a lot of CPU time and we hope the above numbers
> (public for the first time) will help to dispel that. \[emphasis in
> original\]

Is it any wonder Gmail performs well, even when using HTTPS exclusively?
Site operators can realize incremental improvement by gradually tuning
their web applications. Chris gave a presentation to this effect at
[Web 2.0
Expo 2009](http://assets.en.oreilly.com/1/event/22/High%20Performance,%20Low%20Cost,%20and%20Strong%20Security_%20Pick%20Any%20Three%20Presentation.pdf).

## Conclusion

HTTPS provides the baseline of safety for web application users, and
there is no performance- or cost-based reason to stick with HTTP. Web
application providers [undermine their business
models](http://papers.ssrn.com/sol3/papers.cfm?abstract_id=1421553)
when, by continuing to use HTTP, they enable a wide range of attackers
anywhere on the internet to compromise users' information.

