import { getRequestIP, type H3Event } from "h3";

/**
 * Whether a request to the dev server originates from the loopback interface.
 *
 * Used to gate dev-only debug endpoints (the VFS viewer and the task runner) so
 * they are not reachable from other hosts when the dev server is bound to a
 * non-loopback address, which is the default (`devServer.hostname` is unset).
 */
export function isLocalDevRequest(event: H3Event): boolean {
  const { socket } = event.runtime?.node?.req || {};

  // prettier-ignore
  const isUnixSocket =
    // No network addresses
    (!socket?.remoteAddress && !socket?.localAddress) &&
    // Empty address object
    Object.keys(socket?.address?.() || {}).length === 0 &&
    // Socket is readable/writable but has no port info
    socket?.readable && socket?.writable && !socket?.remotePort;

  const ip = getRequestIP(event, { xForwardedFor: isUnixSocket });
  const v4 = ip?.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip;

  return Boolean(v4 && /^(?:::1|127\.\d+\.\d+\.\d+)$/.test(v4));
}
