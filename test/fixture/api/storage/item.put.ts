export default eventHandler(async (event) => {
  const { base = "", key = "" } = getQuery(event) as Record<string, string>;
  const storage = useStorage(`test:${base}`);
  const value = await readBody(event);
  await storage.setItem(key, value);
  return value;
});
