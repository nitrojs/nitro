const sharedRuntimeConfig = useRuntimeConfig();

export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();

  return {
    runtimeConfig,
    sharedRuntimeConfig,
  };
});
