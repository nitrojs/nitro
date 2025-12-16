import { useRuntimeConfig } from "nitro/runtime-config";

const sharedRuntimeConfig = useRuntimeConfig();

export default () => {
  const runtimeConfig = useRuntimeConfig();

  return {
    runtimeConfig,
    sharedRuntimeConfig,
  };
};
