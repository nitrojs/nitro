const sharedRuntimeConfig = useRuntimeConfig();

export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event);

  return {
    runtimeConfig,
    sharedRuntimeConfig,
  };
});
