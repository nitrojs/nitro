import packageJson from "../package.json" with { type: "json" };

export const version = packageJson.version;

export const compatibilityChanges = [
  {
    from: "2024-05-07",
    platform: "netlify",
    description: "Netlify functions v2",
  },
  {
    from: "2024-09-19",
    platform: "cloudflare",
    description: "Static assets support for cloudflare-module preset",
  },
  {
    from: "2025-01-30",
    platform: "deno",
    description: "Deno v2 Node.js compatibility",
  },
];
