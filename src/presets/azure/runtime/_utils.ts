import type { Cookie, HttpRequest } from "@azure/functions";
import { parse } from "cookie-es";

export function getAzureParsedCookiesFromHeaders(headers: Headers): Cookie[] {
  const setCookieHeader = headers.getSetCookie();
  if (setCookieHeader.length === 0) {
    return [];
  }
  const azureCookies: Cookie[] = [];
  for (const setCookieStr of setCookieHeader) {
    const setCookie = Object.entries(parse(setCookieStr));
    if (setCookie.length === 0) {
      continue;
    }
    const [[key, value], ..._setCookieOptions] = setCookie;
    const setCookieOptions = Object.fromEntries(
      _setCookieOptions.map(([k, v]) => [k.toLowerCase(), v])
    );
    const cookieObject: Cookie = {
      name: key,
      value: value || "",
      domain: setCookieOptions.domain,
      path: setCookieOptions.path,
      expires: parseNumberOrDate(setCookieOptions.expires || ""),
      sameSite: setCookieOptions.samesite as "Lax" | "Strict" | "None",
      maxAge: parseNumber(setCookieOptions["max-age"] || ""),
      secure: setCookieStr.includes("Secure") ? true : undefined,
      httpOnly: setCookieStr.includes("HttpOnly") ? true : undefined,
    };
    azureCookies.push(cookieObject);
  }
  return azureCookies;
}

export function resolveBaseUrl(req: HttpRequest) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = forwardedHost || req.headers["host"];
  if (host) {
    const candidate = `${forwardedProto || "http"}://${host}`;
    try {
      return new URL(candidate).origin;
    } catch (error) {
      console.warn("[nitro] Invalid Azure SWA forwarded origin", {
        candidate,
        error,
      });
    }
  }
  const originalUrl = req.headers["x-ms-original-url"];
  if (originalUrl) {
    try {
      return new URL(originalUrl).origin;
    } catch {
      // ignore invalid original URL
    }
  }
  return "http://localhost";
}

function parseNumberOrDate(expires: string) {
  const expiresAsNumber = parseNumber(expires);
  if (expiresAsNumber !== undefined) {
    return expiresAsNumber;
  }
  // Convert to Date if possible
  const expiresAsDate = new Date(expires);
  if (!Number.isNaN(expiresAsDate.getTime())) {
    return expiresAsDate;
  }
}

function parseNumber(maxAge: string) {
  if (!maxAge) {
    return undefined;
  }
  // Convert to number if possible
  const maxAgeAsNumber = Number(maxAge);
  if (!Number.isNaN(maxAgeAsNumber)) {
    return maxAgeAsNumber;
  }
}
