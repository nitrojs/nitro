import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler(() => {
  const { greeting } = useRuntimeConfig();
  return { message: `${greeting} from Nitro!` };
});
