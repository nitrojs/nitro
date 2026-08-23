// Percent-encodes the non-ASCII characters in a route pattern, leaving the rest untouched.
export function encodeNonAsciiRoute(route: string): string {
  let hasNonAscii = false;
  for (let i = 0; i < route.length; i++) {
    if (route.charCodeAt(i) > 127) {
      hasNonAscii = true;
      break;
    }
  }
  if (!hasNonAscii) {
    return route;
  }
  return Array.from(route)
    .map((char) => (char.codePointAt(0)! > 127 ? encodeURIComponent(char) : char))
    .join("");
}
