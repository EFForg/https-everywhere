# Browser Distribution Special Cases

## Edge

Case:
Edge does not accept CRX files for direct upload to store.

Work around: `edge.sh`

## Opera

Case:
Opera does not accept `default.rulesets` due to strict MIME type restriction

In order to not disrupt many downstream channels, we are building a separate CRX file for Opera for now.

Work around: `opera.sh`

## Build process

These scripts are normally ran after main build and deployment is finished. The reason being we want a confirmed CRX file upload to Chrome to build the Edge zip and Opera crx distributions on.

## CRX Verification of Files before Upload

Install Node Package for CRX Verification via NPM
`[sudo] npm -g i crx3-utils`

### Verify CRX file

1. `crx3-info rsa 0 < $crx > public.pem`
2. `crx3-verify rsa 0 public.pem < $crx`
3. `echo "CRX verified"`
