export default eventHandler(async () => {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { ok: true };
});
