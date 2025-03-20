export default eventHandler(async (event) => {
  const current = new Date();

  await runTask("echo", {
    context: {
      waitFor: 1,
    },
  });

  const after = new Date();

  return {
    current: current.toISOString(),
    after: after.toISOString(),
  };
});
