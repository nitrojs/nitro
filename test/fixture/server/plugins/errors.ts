import { definePlugin } from "nitro";

export const allErrors: { error: Error; context: any }[] = [];

export default definePlugin((app) => {
  app.hooks.hook("error", (error, context) => {
    allErrors.push({ error, context });
  });
});
