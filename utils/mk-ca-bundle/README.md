This file comes from the [curl source
repository](https://github.com/curl/curl).

To update the certificate bundle used in the Continuous Integration tests, run:

```sh
./mk-ca-bundle.pl -d release ../../test/rules/platform_certs/default/ca-bundle.crt
```
