# Cloudflare Workflows Example

This example demonstrates how to use Cloudflare Workflows with Nitro.

Workflows are durable, fault-tolerant execution environments that enable you to orchestrate complex, multi-step operations with automatic retries and state management.

## What are Workflows?

Cloudflare Workflows provide:

- **Durable execution**: Steps are persisted and survive restarts
- **Automatic retries**: Failed steps are automatically retried
- **Sleep/delays**: Workflows can pause for hours or days
- **State management**: Workflow state is automatically managed

Learn more: [Cloudflare Workflows Documentation](https://developers.cloudflare.com/workflows/)

## Configuration

### 1. Configure in `nitro.config.ts`

```typescript
export default defineNitroConfig({
  preset: "cloudflare-module",

  cloudflare: {
    deployConfig: true,

    workflows: [
      {
        name: "order-processing",
        className: "OrderProcessingWorkflow",
        binding: "ORDER_WORKFLOW",
      },
    ],
  },
});
```

### 2. Define Workflow Classes in `exports.cloudflare.ts`

```typescript
export class OrderProcessingWorkflow {
  async run(event: any, step: any) {
    // Step 1: Validate
    const order = await step.do("validate", async () => {
      return { valid: true, orderId: event.orderId };
    });

    // Step 2: Process
    await step.do("process", async () => {
      console.log("Processing order:", order.orderId);
    });

    return { completed: true };
  }
}
```

### 3. Trigger Workflows from Your Routes

```typescript
export default defineEventHandler(async (event) => {
  const env = event.context.cloudflare?.env;

  // Create a workflow instance
  const instance = await env.ORDER_WORKFLOW.create({
    params: { orderId: "123" },
  });

  return { instanceId: instance.id };
});
```

## Workflow Features

### Step Execution

Each `step.do()` call creates a durable step:

```typescript
const result = await step.do("step-name", async () => {
  // Your logic here
  return { data: "value" };
});
```

### Sleep/Delays

Workflows can sleep for extended periods:

```typescript
// Sleep for 1 hour
await step.sleep("wait-one-hour", 3600000);
```

### Error Handling

Steps are automatically retried on failure. You can also handle errors:

```typescript
try {
  await step.do("risky-operation", async () => {
    // Might fail
  });
} catch (error) {
  await step.do("handle-error", async () => {
    console.error("Operation failed:", error);
  });
}
```

## Running This Example

### Local Development

```bash
pnpm install
pnpm dev
```

### Deploy to Cloudflare

```bash
pnpm build
npx wrangler deploy
```

## API Endpoints

This example includes these endpoints:

- `POST /api/workflow/create-order` - Start an order processing workflow
- `POST /api/workflow/send-notification` - Start a notification workflow
- `GET /api/workflow/get-status?workflowId=xxx` - Check workflow status

## Example Requests

### Create an Order

```bash
curl -X POST http://localhost:3000/api/workflow/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-123",
    "items": [
      { "id": "item-1", "quantity": 2 }
    ]
  }'
```

### Send a Delayed Notification

```bash
curl -X POST http://localhost:3000/api/workflow/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-456",
    "message": "Your order has shipped!",
    "channel": "email",
    "delayMs": 3600000
  }'
```

### Check Workflow Status

```bash
curl http://localhost:3000/api/workflow/get-status?workflowId=<instance-id>
```

## Best Practices

1. **Keep steps idempotent**: Steps may be retried
2. **Use meaningful step names**: Helps with debugging
3. **Don't store large data in workflow state**: Use external storage for large payloads
4. **Handle errors gracefully**: Use try/catch for critical operations

## Learn More

- [Cloudflare Workflows Documentation](https://developers.cloudflare.com/workflows/)
- [Nitro Cloudflare Preset](https://nitro.unjs.io/deploy/providers/cloudflare)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
