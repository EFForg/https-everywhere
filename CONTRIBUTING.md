# Contributing rulesets to HTTPS Everywhere

If you want to create new rules to submit to us, we expect them to be in the `src/chrome/content/rules` directory. That directory also contains a useful script, `make-trivial-rule`, to create a simple rule for a specified domain. There is also a script called `utils/trivial-validate.py`, to check all the pending rules for several common errors and oversights. For example, if you wanted to make a rule for the `example.com` domain, you could run:
```
cd src/chrome/content/rules
bash ./make-trivial-rule example.com
```
This would create `Example.com.xml`, which you could then take a look at and edit based on your knowledge of any specific URLs at `example.com` that do or don't work in HTTPS. Please have a look at our [Ruleset Style Guide](https://github.com/EFForg/https-everywhere/blob/master/ruleset-style.md) where you can find useful tips about finding more subdomains. Our goal is to have as many subdomains covered as we can find.

A more detailed guide about the syntax can be found at [EFF.org](https://www.eff.org/https-everywhere/rulesets).
For questions see our [FAQ](https://www.eff.org/https-everywhere/faq) page.
