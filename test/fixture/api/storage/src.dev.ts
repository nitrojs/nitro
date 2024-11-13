export default defineEventHandler(async (event) => {
  const storage = useStorage();
  return {
    keys: await storage.getKeys("src"),
  };
});
