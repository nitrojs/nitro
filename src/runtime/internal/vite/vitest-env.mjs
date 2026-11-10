// https://vitest.dev/guide/environment#custom-environment

import { closeTestApp } from "../test-app.mjs";

/** @type {import("vitest/environments").Environment} */
export default {
  name: "nitro",
  viteEnvironment: "nitro",
  setup() {
    return { teardown: closeTestApp };
  },
};
