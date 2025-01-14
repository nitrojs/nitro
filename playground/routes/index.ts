export default eventHandler(async (event) => {
  throw createError("foo");
});
