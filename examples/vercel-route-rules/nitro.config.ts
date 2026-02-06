import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  preset: "vercel",
  routeRules: {
    // Simple proxy → Vercel CDN rewrite (no function invocation)
    "/proxy/simple/**": {
      proxy: "https://httpbin.org/anything/**",
    },
    // Simple proxy without path forwarding → Vercel CDN rewrite
    "/proxy/no-path/**": {
      proxy: "https://httpbin.org/anything",
    },
    // Proxy with headers → Vercel CDN rewrite with headers
    "/proxy/with-headers/**": {
      proxy: "https://httpbin.org/anything/**",
      headers: { "x-custom": "value" },
    },
    // Complex proxy with ProxyOptions → runtime (function invocation)
    "/proxy/complex/**": {
      proxy: {
        to: "https://httpbin.org/anything/**",
        cookieDomainRewrite: "example.com",
      },
    },
    // Redirect
    "/api/redirect/**": {
      redirect: {
        to: "https://example.com",
        status: 302,
      },
    },
  },
});
