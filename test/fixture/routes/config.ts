const sharedRuntimeConfig = useRuntimeConfig();

export default eventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event);

  return {
    runtimeConfig,
    sharedRuntimeConfig,
  };
});
