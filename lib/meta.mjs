import packageJson from "../package.json" with { type: "json" };

export const version = packageJson.version;

export const compatibilityChanges = [
  {
    from: "2024-05-07",
    platform: "netlify",
    description: "Netlify Functions v2 output format",
  },
  {
    from: "2024-09-19",
    platform: "cloudflare",
    description: "Static assets support for the `cloudflare-module` preset",
  },
  {
    from: "2025-01-30",
    platform: "deno",
    description: "Deno v2 Node.js compatibility for `deno-server`",
  },
  {
    from: "2025-07-13",
    platform: "cloudflare",
    description: "`cloudflare-dev` preset with Miniflare-based local development",
  },
  {
    from: "2025-07-15",
    platform: "vercel",
    description: "Observability route configuration in the Vercel build output",
  },
];
