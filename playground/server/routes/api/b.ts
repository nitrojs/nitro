export default eventHandler(async (event) => {
  const app = useNitroApp()

  return {
    handlers: app.handlers,
  };
});
