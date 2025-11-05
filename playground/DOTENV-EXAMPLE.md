# Production .env Example

This example demonstrates how to enable `.env` file loading in production builds.

## Important: Runtime vs Build-time

- **Build-time**: `.env` values are loaded into `useRuntimeConfig()`
- **Runtime**: For `process.env` access, you need to either:
  1. Deploy the `.env` file with your build, OR
  2. Set environment variables on your server/platform

Example:
```bash
# Copy .env to output
cp .env .output/
cd .output
NITRO_API_KEY=xxx node server/index.mjs
```

## Files

- `.env` - Development environment variables
- `.env.production` - Production environment variables
- `server/routes/api/env-test.ts` - API endpoint that displays runtime config
- `build-with-dotenv.ts` - Build script with production .env support

## Default Behavior

By default, Nitro only loads `.env` files in **development mode**:

```bash
# Dev mode - .env is automatically loaded
pnpm dev
```

In production, environment variables should come from your deployment platform (Vercel, Cloudflare, AWS, etc.).

## Enabling .env in Production

For local testing or Docker deployments, you can enable `.env` loading in production:

### Option 1: Simple - Load .env in both modes

```ts
import { createNitro, build } from 'nitro/builder'

const nitro = await createNitro(config, {
  dotenv: true  // Loads .env in both dev and production
})

await build(nitro)
```

### Option 2: Advanced - Different files per environment

```ts
const nitro = await createNitro(config, {
  dotenv: {
    dev: { fileName: ['.env', '.env.local'] },
    production: { fileName: ['.env.production', '.env'] }
  }
})
```

## Try it

1. **Build with production .env**:
   ```bash
   tsx playground/build-with-dotenv.ts
   ```

2. **Run the production build**:
   ```bash
   node playground/.output/server/index.mjs
   ```

3. **Test the API**:
   ```bash
   curl http://localhost:3000/api/env-test
   ```

   Expected response:
   ```json
   {
     "message": "Environment variables test",
     "apiKey": "production_secret_key_67890",
     "appName": "Nitro Playground (Production)",
     "note": "Set NITRO_API_KEY and NITRO_APP_NAME in .env file"
   }
   ```

## Environment Variables

Set variables in your `.env` files with the `NITRO_` prefix:

```bash
# .env.production
NITRO_API_KEY=production_secret_key_67890
NITRO_APP_NAME=Nitro Playground (Production)
```

They map to runtime config in camelCase:

```ts
// In your code
const config = useRuntimeConfig()
console.log(config.apiKey)   // "production_secret_key_67890"
console.log(config.appName)  // "Nitro Playground (Production)"
```

## Important Notes

- `.env` files are **NOT** recommended for production deployments
- Use platform-specific environment variables instead:
  - Vercel: Project Settings → Environment Variables
  - Cloudflare: `wrangler.toml` or Dashboard Secrets
  - AWS Lambda: Function configuration
  - Docker: `-e` flags or mounted `.env` files
- This feature is useful for:
  - Local production testing
  - Docker containers
  - Self-hosted deployments
