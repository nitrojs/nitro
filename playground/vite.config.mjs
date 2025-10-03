import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import inspect from "vite-plugin-inspect";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [nitro(), inspect(), tailwindcss()],
});
