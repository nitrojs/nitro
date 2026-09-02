import { defineConfig } from "nitro";
import { fileURLToPath } from "node:url";

const runtimeDir = fileURLToPath(new URL("./pkg/runtime", import.meta.url));

export default defineConfig({
  preset: "standard",
  alias: {
    "#pkg": runtimeDir,
    "#pkg/network-dispatcher": runtimeDir + "/server/utils/network-dispatcher.node",
  },
});
