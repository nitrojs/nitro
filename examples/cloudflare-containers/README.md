# Cloudflare Containers Example

This example demonstrates how to use Cloudflare Containers with Nitro and Durable Objects.

Containers enable running containerized applications alongside Durable Objects, giving you the power of containerized workloads with Cloudflare's edge network.

## What are Cloudflare Containers?

Cloudflare Containers allow you to:

- Run containerized applications at the edge
- Connect containers to Durable Objects for state management
- Scale containers automatically based on demand
- Deploy Docker images to Cloudflare's network

Learn more: [Cloudflare Containers Documentation](https://developers.cloudflare.com/containers/)

## Prerequisites

Containers require:

1. **Durable Objects**: Containers connect to Durable Objects
2. **Docker**: For building container images
3. **Cloudflare Account**: With Containers enabled

## Configuration

### 1. Configure in `nitro.config.ts`

```typescript
export default defineNitroConfig({
  preset: "cloudflare-durable",

  cloudflare: {
    deployConfig: true,

    containers: [
      {
        className: "ProcessorDO",
        image: "./Dockerfile",
        instanceType: "basic",
        maxInstances: 10,
      },
    ],
  },
});
```

### 2. Define Durable Object in `exports.cloudflare.ts`

Containers connect to Durable Objects:

```typescript
import { DurableObject } from "cloudflare:workers";

export class ProcessorDO extends DurableObject {
  async fetch(request: Request) {
    // Handle requests from your Worker or Container
    return new Response("Hello from Durable Object!");
  }
}
```

### 3. Create a Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Your container setup
COPY package.json .
RUN npm install

COPY . .

CMD ["node", "server.js"]
```

## Container Configuration Options

### Instance Types

- **dev**: Small instances for development
- **basic**: Standard instances for production
- **standard**: Larger instances for heavy workloads

### Scaling

```typescript
containers: [
  {
    className: "ProcessorDO",
    image: "./Dockerfile",
    instanceType: "basic",
    maxInstances: 20, // Auto-scale up to 20 instances
    schedulingPolicy: "regional", // or "moon" or "default"
  },
];
```

### Build Context

```typescript
containers: [
  {
    className: "ProcessorDO",
    image: "./Dockerfile",
    imageBuildContext: "./docker", // Custom build context
    imageVars: {
      // Build-time variables
      NODE_ENV: "production",
    },
  },
];
```

## Development vs Production

### Local Development

Containers are not available in local development mode. The example will run as a standard Nitro app:

```bash
pnpm dev
```

### Production Deployment

Deploy to Cloudflare with containers:

```bash
pnpm build
npx wrangler deploy
```

## Use Cases

### 1. Stateful Processing

Use containers for CPU-intensive tasks with Durable Objects for state:

- Video processing
- Image manipulation
- Data transformation
- Machine learning inference

### 2. Legacy Application Migration

Run existing containerized applications at the edge:

- Existing Node.js apps
- Python services
- Custom runtimes

### 3. Edge Computing

Combine Workers, Durable Objects, and Containers:

- Workers handle HTTP routing
- Durable Objects manage state
- Containers perform heavy computations

## Architecture Pattern

```
┌─────────────┐
│   Worker    │  ← Handles HTTP requests
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Durable Object  │  ← Manages state and coordination
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   Container     │  ← Performs heavy processing
└─────────────────┘
```

## Important Notes

1. **Containers are production-only**: Not available in local development
2. **Requires Durable Objects**: Containers must connect to a Durable Object
3. **Docker required**: You need Docker to build images
4. **Regional deployment**: Containers have specific regional requirements

## Learn More

- [Cloudflare Containers Documentation](https://developers.cloudflare.com/containers/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Nitro Cloudflare Preset](https://nitro.unjs.io/deploy/providers/cloudflare)
