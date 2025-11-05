import { defineEventHandler } from "nitro/h3";
import { useRuntimeConfig } from "nitro/runtime";

export default defineEventHandler(() => {
  const config = useRuntimeConfig();
  console.log("API Key:", process.env.NITRO_API_KEY);
  return {
    message: "Environment variables test",
    apiKey: config.apiKey || "not-set",
    appName: config.appName || "not-set",
    note: "Values loaded from .env file at build time",
  };
});
