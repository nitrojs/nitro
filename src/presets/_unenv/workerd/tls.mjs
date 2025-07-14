// https://github.com/cloudflare/workerd/blob/main/src/node/tls.ts

import workerdTLS from "#workerd/node:tls";

import { createSecurePair } from "unenv/node/tls";

export { createSecurePair } from "unenv/node/tls";

export const {
  TLSSocket,
  connect,
  SecureContext,
  checkServerIdentity,
  convertALPNProtocols,
  createSecureContext,
  CLIENT_RENEG_LIMIT,
  CLIENT_RENEG_WINDOW,
  DEFAULT_CIPHERS,
  DEFAULT_ECDH_CURVE,
  DEFAULT_MAX_VERSION,
  DEFAULT_MIN_VERSION,
  Server,
  createServer,
  getCiphers,
  rootCertificates,
} = workerdTLS;

export default {
  // native
  TLSSocket,
  connect,
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
  createServer,
  getCiphers,
  rootCertificates,
  // polyfill
  createSecurePair,
};
