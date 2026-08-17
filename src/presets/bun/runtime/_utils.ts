export function parseBunIdleTimeout(value: string | undefined) {
  if (!/^\d+$/.test(value || "")) {
    return undefined;
  }

  const timeout = Number(value);
  return timeout >= 0 && timeout <= 255 ? timeout : undefined;
}
