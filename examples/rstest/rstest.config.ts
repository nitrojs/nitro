import { defineConfig } from "@rstest/core";
import { nitro } from "nitro/rsbuild";

export default defineConfig({ plugins: [nitro()] });
