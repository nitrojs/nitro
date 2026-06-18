export default eventHandler(async () => {
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  return { ok: true };
});
