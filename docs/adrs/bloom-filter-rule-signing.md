# Bloom Filters and Async Rust for Ruleset Signing

* Status: Deployed
* Deciders: EFF (@zoracon and @hainish)
* Deploy Date: 2021-03-03

## Context and Problem Statement

With larger ruleset lists to be signed on the DuckDuckGo Update channel, a better way to digest and form ruleset files were needed.

## Decision Drivers

* Bloom filters are able to ingest greater data sets at less memory expense
* Rust is already incorporated in HTTPS Everywhere and is a memory safe language

## Decision Outcome

Created an async Rust script that ingests DuckDuckGo's Smarter Encryption list, compares to the Majestic Million list, and forms a bloom file and associated metadata.

### Consequences and Concerns

An accepted false positive is declared when the filter is generated.

[Comment](https://github.com/EFForg/https-everywhere/pull/19910#issuecomment-771102775)

## Links for Further Context
* [Bloom Filter Script](https://github.com/EFForg/generate-smarter-encryption-bloom-filter)

