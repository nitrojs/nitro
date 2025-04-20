// https://github.com/cloudflare/workerd/blob/main/src/node/tls.ts

import workerdTLS from "#workerd/node:tls";

import {
  CLIENT_RENEG_LIMIT,
  CLIENT_RENEG_WINDOW,
  DEFAULT_CIPHERS,
  DEFAULT_ECDH_CURVE,
  DEFAULT_MAX_VERSION,
  DEFAULT_MIN_VERSION,
  Server,
  createSecurePair,
  createServer,
  getCiphers,
  rootCertificates,
} from "unenv/node/tls";

export {
  CLIENT_RENEG_LIMIT,
  CLIENT_RENEG_WINDOW,
  DEFAULT_CIPHERS,
  DEFAULT_ECDH_CURVE,
  DEFAULT_MAX_VERSION,
  DEFAULT_MIN_VERSION,
  Server,
  createSecurePair,
  createServer,
  getCiphers,
  rootCertificates,
} from "unenv/node/tls";

export const {
  TLSSocket,
  connect,
  SecureContext,
  checkServerIdentity,
  convertALPNProtocols,
  createSecureContext,
} = workerdTLS;

export default {
  // native
  TLSSocket,
  connect,
  // polyfill
  CLIENT_RENEG_LIMIT,
  CLIENT_RENEG_WINDOW,
  DEFAULT_CIPHERS,
  DEFAULT_ECDH_CURVE,
  DEFAULT_MAX_VERSION,
  DEFAULT_MIN_VERSION,
  SecureContext,
  Server,
  checkServerIdentity,
  convertALPNProtocols,
  createSecureContext,
  createSecurePair,
  createServer,
  getCiphers,
  rootCertificates,
};
