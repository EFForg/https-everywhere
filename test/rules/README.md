# HTTPS Everywhere Rule Checker

Author: Ondrej Mikle, CZ.NIC (ondrej.mikle@nic.cz)

## Configuration

Copy `checker.config.sample` to `checker.config` and change the `rulesdir` under `[rulesets]` to point to a directory with the XML files of HTTPS Everywhere rules (usually the `src/chrome/content/rules` of locally checked out git tree of HTTPS Everywhere).

## Running

Once you have modified the config, run:

    check-https-rules checker.config

Output will be written to selected log file, infos/warnings/errors contain the useful information.

## Features

* Attempts to follow Firefox behavior as closely as possible (including rewriting HTTP redirects according to rules; well except for Javascript and meta-redirects)
* IDN domain support
* Currently two metrics on "distance" of two resources implemented, one is purely string-based, the other tries to measure "similarity of the shape of DOM tree"
* Multi-threaded scanner
* Support for various "platforms" (e.g. CAcert), i.e. sets of CA certificate sets which can be switched during following of redirects
* set of used CA certificates can be statically restricted to one CA certificate set (see `static_ca_path` in config file)

## What errors in rulesets can be detected

* big difference in HTML page structure
* error in ruleset - declared target that no rule rewrites, bad regexps (usually capture groups are wrong), incomplete FQDNs, non-existent domains
* HTTP 200 in original page, while rewritten page returns 4xx/5xx
* cycle detection in redirects
* transvalid certificates (incomplete chains)
* other invalid certificate detection (self-signed, expired, CN mismatch...)

## False positives and shortcomings

* Some pages deliberately have different HTTP and HTTPS page, some for example redirect to different page under https
* URLs to scan are naively guessed from target hosts, having test set of URLs in a ruleset would improve it (better coverage)

## Known bugs

### At most 9 capture groups in rule supported

This is a workaround for ambiguous rewrites in rules such as:

    <rule from="^http://(www\.)?01\.org/" to="https://$101.org/" />

The `$101` would actually mean 101-st group, so we assume that only first digit after `$` denotes the group (which is how it seems to work in javascript).

### May not work under Windows

According to [PyCURL documentation](http://curl.haxx.se/libcurl/c/curl_easy_setopt.html#CURLOPTCAPATH), using CAPATH may not work under Windows. I'd guess it's due to openssl's `c_rehash` utility that creates symlinks to PEM certificates. Hypothetically it could work if the symlinks were replaced by regular files with identical names, but haven't tried.

### Threading bugs and workarounds

There are some race conditions with Python threads and OpenSSL/GnuTLS that cause about due to SIGPIPE or SIGSEGV. While libcurl code seems to have implemented the necessary callbacks, there's a bug somewhere :-)

Workaround: set `fetch_in_subprocess` under `http` section in config to true when using multiple threads for fetching. Using subprocess is on by default.

You might have to set PYTHONPATH if working dir is different from code dir with python scripts.

If underlying SSL library is NSS, threading looks fine.

As a side effect, the CURL+NSS SNI bug does not happen with subprocesses (SSL session ID cache is not kept among process invocations).

If pure-threaded version starts eating too much memory (like 1 GB in a minute), turn on the ``fetch_in_subprocess`` option metioned above. Some combinations of CURL and SSL library versions do that. Spawning separate subprocesses prevents any caches building up and eating too much memory.

Using subprocess hypothetically might cause a deadlock due to insufficient buffer size when exchanging data through stdin/stdout in case of a large HTML page, but hasn't happened for any of the rules (I've tried to run them on the complete batch of rulesets contained in HTTPS Everywhere Nov 2 2012 commit c343f230a49d960dba90424799c3bacc2325fc94). Though in case deadlock happens, increase buffer size in `subprocess.Popen` invocation in `http_client.py`.

### Generic bugs/quirks of SSL libraries

Each of the three possible libraries (OpenSSL, GnuTLS, NSS) has different set of quirks. GnuTLS seems to be the most strict one regarding relevant RFCs and will not for instance tolerate certificate chain in wrong order or forgive server not sending `close_notify` alert.

Thus it's entirely possible that while a server chain and SSL/TLS handshake seems OK when using one lib, it may break with the other.
