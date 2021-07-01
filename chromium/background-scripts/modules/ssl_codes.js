"use strict";

/**
 * @exports error_list
 * @type {array}
 * @description A list of known SSL config errors to filter through and not try to upgrade the user
 * @see
 * Chrome SSL errors: https://github.com/chromium/chromium/blob/master/components/domain_reliability/util.cc
 * Firefox SSL Errors: https://hg.mozilla.org/releases/mozilla-release/file/tip/security/manager/locales/en-US/chrome/pipnss/nsserrors.properties
 */

(function (exports) {

const error_list = [
  "net::ERR_SSL_PROTOCOL_ERROR",
  "net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH",
  "net::ERR_SSL_UNRECOGNIZED_NAME_ALERT",
  "net::ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN",
  "net::ERR_CERT_COMMON_NAME_INVALID",
  "net::ERR_CERT_DATE_INVALID",
  "net::ERR_CERT_AUTHORITY_INVALID",
  "net::ERR_CERT_REVOKED",
  "net::ERR_CERT_INVALID",
  "net::ERR_CONNECTION_CLOSED",
  "net::ERR_CONNECTION_RESET",
  "net::ERR_CONNECTION_REFUSED",
  "net::ERR_CONNECTION_ABORTED",
  "net::ERR_CONNECTION_FAILED",
  "net::ERR_ABORTED", ,
  "NS_ERROR_CONNECTION_REFUSED",
  "NS_ERROR_NET_ON_TLS_HANDSHAKE_ENDED",
  "NS_BINDING_ABORTED",
  "SSL received a record that exceeded the maximum permissible length.",
  "Peer’s Certificate has expired.",
  "Unable to communicate securely with peer: requested domain name does not match the server’s certificate.",
  "Peer’s Certificate issuer is not recognized.",
  "Peer’s Certificate has been revoked.",
  "Peer reports it experienced an internal error.",
  "The server uses key pinning (HPKP) but no trusted certificate chain could be constructed that matches the pinset. Key pinning violations cannot be overridden.",
  "SSL received a weak ephemeral Diffie-Hellman key in Server Key Exchange handshake message.",
  "The certificate was signed using a signature algorithm that is disabled because it is not secure.",
  "Cannot communicate securely with peer: no common encryption algorithm(s).",
  "SSL peer has no certificate for the requested DNS name."
];

Object.assign(exports, { error_list });

})(typeof exports !== 'undefined' ? exports : require.scopes.ssl_codes = {});