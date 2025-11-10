/// <reference types="@vitejs/devtools-kit" />
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { nitro } from "nitro/vite";

// https://vite-devtools.netlify.app/guide/
import { DevTools } from "@vitejs/devtools";

export default defineConfig({
  plugins: [DevTools(), nitro(), ExamplePlugin()],
  build: {
    rolldownOptions: {
      debug: {}, // enable debug mode
    },
  },
});

// https://vite-devtools.netlify.app/kit/
function ExamplePlugin(): Plugin {
  return {
    name: "nitro:docs",
    devtools: {
      setup(ctx) {
        ctx.docks.register({
          id: "nitro:docs",
          type: "iframe",
          title: "Nitro",
          icon: "https://v3.nitro.build/icon.svg",
          url: "https://v3.nitro.build/docs/quick-start",
        });
      },
    },
  };
}
