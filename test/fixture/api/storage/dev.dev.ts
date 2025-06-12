export default defineHandler(async (event) => {
  const storage = useStorage();
  return {
    keys: await storage.getKeys("/src/public"),
  };
});
