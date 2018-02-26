## HTTPS Everywhere Development

### Pointers for developers

*   **License:** GPL version 3+ (although most of the code is GPL-2 compatible)
*   **Source code:** Available via Git with `git clone
    https://github.com/EFForg/https-everywhere.git`. You can fork and open pull
    requests using Github at
    [https://github.com/EFForg/https-everywhere](https://github.com/EFForg/https-everywhere).
*   **Translations:** If you would like to help translate HTTPS Everywhere into
    another language, you can do that [through
    Transifex](https://www.transifex.com/otf/torproject/).
*   **Bug tracker:** Use the [GitHub issue
    tracker](https://github.com/EFForg/https-everywhere/issues/) or the [Tor
    Project issue tracker](https://trac.torproject.org/projects/tor/report/19).
    For the Tor Project issue tracker, you can make an account or use the
    anonymous one — "cypherpunks"/"writecode". You won't see replies unless you
    put an email address in the CC field. Bugs that are caused by rulesets
    should be tagged "httpse-ruleset-bug", and can be viewed [in this
    report](https://trac.torproject.org/projects/tor/report/48).
*   **Mailing lists:** The
    [https-everywhere](https://lists.eff.org/mailman/listinfo/https-everywhere)
    list ([archives](https://lists.eff.org/pipermail/https-everywhere/)) is for
    discussing the project as a whole; the
    [https-everywhere-rules](https://lists.eff.org/mailman/listinfo/https-everywhere-rules)
    mailing list
    ([archives](https://lists.eff.org/pipermail/https-everywhere-rules)) is for
    discussing the [rulesets](https://www.eff.org/https-everywhere/rulesets)
    and their contents, including patches and git pull requests.
*   **IRC:** `#https-everywhere` on `irc.oftc.net`; if you don't have an IRC
    client application already installed, you can [use this webchat
    interface](https://webchat.oftc.net/?channels=#https-everywhere). If you
    ask a question, be sure to stay in the channel — someone may reply a few
    hours or a few days later.

### Testing and contributing changes to the source code

HTTPS Everywhere consists of a large number of rules for switching sites from
HTTP to HTTPS. You can read more about how to write these rules
[here](https://www.eff.org/https-everywhere/rulesets).

If you want to create new rules to submit to us, we expect them to be in the
src/chrome/content/rules directory. That directory also contains a useful
script, make-trivial-rule, to create a simple rule for a specified domain.
There is also a script in test/validations/special/run.py, to check all the
pending rules for several common errors and oversights. For example, if you
wanted to make a rule for the example.com domain, you could run

    bash ./make-trivial-rule example.com

inside the rules directory. This would create Example.com.xml, which you could
then take a look at and edit based on your knowledge of any specific URLs at
example.com that do or don't work in HTTPS.

Before submitting your change, you should test it in Firefox and/or Chrome, as
applicable. You can build the latest version of the extension and run it in a
standalone Firefox profile using:

    bash ./test.sh --justrun

Similarly, to build and run in a standalone Chromium profile, run:

    bash ./run-chromium.sh

You should thoroughly test your changes on the target site: Navigate to as wide
a variety of pages as you can find. Try to comment or log in if applicable.
Make sure everything still works properly.

After running your manual tests, run the automated tests and the fetch tests:

    bash ./test.sh

    bash ./fetch-test.sh

This will catch some of the most common types of errors, but is not a
guaranteed of correctness.

Once you've tested your changes, you can submit them for review via any of the
following:

*   Open a pull request at
    [https://github.com/EFForg/https-everywhere](https://github.com/EFForg/https-everywhere).
*   Email https-everywhere-rules@eff.org to tell us about your changes. You can
    use the following command to create a patch file: `git format-patch`

### A quick HOWTO on working with Git

You may want to also look at the [Git Reference](http://gitref.org/), [GitHub
Help Site](https://help.github.com/) and the [Tor Project's Git
documentation](https://gitweb.torproject.org/githax.git/tree/doc/Howto.txt) to
fill in the gaps here, but the below should be enough to get the basics of the
workflow down.

First, tell git your name:

    git config --global user.name "Your Name"   git config --global user.email "you@example.com"

Then, get a copy of the 'origin' repository:

    git clone https://github.com/EFForg/https-everywhere.git
    cd https-everywhere

Alternatively, if you already have a Github account, you can create a "fork" of
the repository on Github at
[https://github.com/EFForg/https-everywhere](https://github.com/EFForg/https-everywhere).
See [this page](https://help.github.com/articles/fork-a-repo) for a tutorial.

Once you have a local copy of the repository, create a new branch for your
changes and check it out:

    git checkout -b my-new-rules master

When you want to send us your work, you'll need to add any new files to the
index with git add:

    git add ./src/chrome/content/rules/MyRule1.xml
    git add ./src/chrome/content/rules/MyRule2.xml

You can now commit your changes to the local branch. To make things easier, you
should commit each xml file individually:

    git commit ./src/chrome/content/rules/MyRule1.xml
    git commit ./src/chrome/content/rules/MyRule2.xml

Now, you need a place to publish your changes. You can create a github account
here: [https://github.com/join](https://help.github.com/).
[https://help.github.com/](https://help.github.com/) describes the account
creation process and some other github-specific things.

Once you have created your account and added your remote in your local
checkout, you want to push your branch to your github remote:

    git push github my-new-rules:my-new-rules

Periodically, you should re-fetch the master repository:

    git pull master
