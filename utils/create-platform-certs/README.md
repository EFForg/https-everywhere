# create-platform-certs

This repository creates and fills `test/rules/platform_certs/default/`.

## Setup

Download `certdata.txt` and `mk-ca-bundle.pl` and put them in this directory.
You can find the download locations in `SHA256SUMS`.

## Run

You can repopulate the certificates with `create_platform_certs.sh`. The
certificates should be bit-for-bit identical if you use the same `certdata.txt`
and `mk-ca-bundle.pl`.

You can update the certificates by using a new `certdata.txt` and
`mk-ca-bundle.pl`. Be sure to also update `SHA256SUMS`.
