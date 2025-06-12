export default defineHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const payload = { ...getQuery(event) };
  const { result } = await runTask(name, { payload });
  return {
    name,
    payload,
    result,
  };
});
