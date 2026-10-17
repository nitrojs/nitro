import type { Deno as _Deno } from "@deno/types";

export function getClientIP(
  headers: Headers | { get(name: string): string | null },
  info?: _Deno.ServeHandlerInfo
): string | undefined {
  return (
    headers.get("x-forwarded-for")?.split(",").shift()?.trim() ||
    (info?.remoteAddr as _Deno.NetAddr)?.hostname
  );
}
