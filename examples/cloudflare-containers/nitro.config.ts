import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "cloudflare-durable",

  cloudflare: {
    // Enable deploy config generation
    deployConfig: true,

    // Configure Containers
    // Containers connect to Durable Objects for state management
    containers: [
      {
        // The Durable Object class this container connects to
        className: "ProcessorDO",

        // Path to Dockerfile or registry image URI
        image: "./Dockerfile",

        // Instance type: "dev", "basic", or "standard"
        instanceType: "basic",

        // Maximum number of container instances
        maxInstances: 10,

        // Optional: Custom build context
        // imageBuildContext: "./docker",

        // Optional: Build-time environment variables
        // imageVars: {
        //   NODE_ENV: "production",
        // },

        // Optional: Scheduling policy
        // schedulingPolicy: "regional",
      },
    ],
  },
});
