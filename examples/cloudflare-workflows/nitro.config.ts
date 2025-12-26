import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "cloudflare-module",

  cloudflare: {
    // Enable deploy config generation
    deployConfig: true,

    // Configure Workflows
    workflows: [
      {
        name: "order-processing",
        className: "OrderProcessingWorkflow",
        binding: "ORDER_WORKFLOW",
      },
      {
        name: "notification-workflow",
        className: "NotificationWorkflow",
        binding: "NOTIFICATION_WORKFLOW",
      },
    ],

    // Note: Containers require Durable Objects
    // See examples/cloudflare-durable for Durable Object setup
  },
});
