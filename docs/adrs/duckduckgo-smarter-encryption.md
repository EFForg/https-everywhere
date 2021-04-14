# Incorporating DuckDuckGo Smarter Encryption

* Status: Pending
* Deciders: EFF (@zoracon and @hainish) and DuckDuckGo
* Deploy Date: 2021-04-15

## Context and Problem Statement

With the increased HTTPS traffic, the current model of listed sites that support HTTPS is no longer a maintenance task that makes sense to uphold.

## Decision Drivers

* Firefox has an HTTPS Only option
* Browsers and websites are moving away from issues that created need for more granular ruleset maintenance.
    * Mixed content is now blocked in major browsers
    * Different domains for secure connection are now an older habit (i.e. secure.google.com)
    * TLS 1.0, 1.1 deprecation 
* Chrome’s Manifest V3 will force the extensions to have a ruleset cap. Instead of competing with other extensions like DuckDuckGo,  if the user prefers to use HTTPS Everywhere or DuckDuckGo's privacy essentials, we will provide the same coverage.
* DuckDuckGo’s Smarter Encryption covers more domains than our current, more manual model.

## Decision Outcome

We chose to add the DuckDuckGo Smarter Encryption update channel, because it no longer is beneficial to diverse efforts with others with similar goals in this space.

### Consequences and Concerns

* We have many downstream partners supported and unofficial that rely on our current rulesets. This transition gives them time to make the needed decisions on their before we completely switch over to using DuckDuckGo's Smart Encryption, and sunset our current rulesets in HTTPS Everywhere
* …

## Links for Further Context

* https://spreadprivacy.com/duckduckgo-smarter-encryption/
* https://www.eff.org/deeplinks/2020/11/10-years-https-everywhere
* [Bloom Filter for Rule Signing]()