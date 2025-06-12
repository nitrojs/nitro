export default defineHandler(() => ({
  internalApiKey: "/api/typed/user/:userId/post/:postId" as const,
}));
