export function normalizeHeaders(headers: Record<string, string | string[] | undefined>): HeadersInit {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      normalized[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }
  return normalized;
}