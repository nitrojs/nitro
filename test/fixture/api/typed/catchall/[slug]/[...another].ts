export default defineHandler(() => ({
  internalApiKey: "/api/typed/catchall/:slug/**:another" as const,
}));
