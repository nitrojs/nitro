export default defineHandler(async (event) => {
  const { base = "", key = "" } = getQuery(event) as Record<string, string>;
  const storage = useStorage(`test:${base}`);

  if (!key || key.endsWith(":")) {
    return await storage.getKeys();
  }

  const value = await storage.getItem(key);
  return value;
});
