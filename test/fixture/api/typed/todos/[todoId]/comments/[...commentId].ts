export default defineHandler(() => ({
  internalApiKey: "/api/typed/todos/:todoId/comments/**:commentId" as const,
}));
