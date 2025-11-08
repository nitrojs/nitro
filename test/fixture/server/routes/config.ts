import { useRuntimeConfig } from "nitro/runtime";

const sharedRuntimeConfig = useRuntimeConfig();

export default () => {
  const runtimeConfig = useRuntimeConfig();

  return {
    runtimeConfig,
    sharedRuntimeConfig,
  };
};
