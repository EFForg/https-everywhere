#!/bin/bash -x
# Usage: get_issuer.sh example.com
#
# If the checker fails with a complaint about a local issuer cert, but Firefox
# successfully fetches a domain, it's likely because the site left out the
# intermediate cert, but Firefox included it. This script tries to simplify the
# process of adding the intermediate so the checker can validate properly.
cd $(dirname $0)/default
DOMAIN="${1}"
ISSUER_URL=$(openssl s_client -connect "${DOMAIN}:443" -servername "${DOMAIN}" -showcerts </dev/null | \
  openssl x509 -text -noout | \
  perl -lne 'print $1 if /CA Issuers - URI:(.*)/')
NAME=$(basename "${ISSUER_URL}" .crt)
curl "${ISSUER_URL}" | openssl x509 -inform der -outform pem > "${NAME}.pem"
if openssl verify -CApath . ${NAME}.pem ; then
#  c_rehash .
  curl --capath . "https://${DOMAIN}" >/dev/null
  echo "Succesfully fetched and verified ${NAME}.pem. Now git add . and commit."
else
  echo "Failed to verify ${NAME}.pem, maybe not a proper intermediate?"
fi
