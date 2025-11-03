export const allErrors: { error: Error; context: any }[] = [];

export default defineNitroPlugin((app) => {
  app.hooks.hook("error", (error, context) => {
    allErrors.push({ error, context });
  });
});
