import { defineConfig } from "nitro";
// import errorHandler from "./error";

export default defineConfig({
  errorHandler: "./error.ts",
  // devErrorHandler: errorHandler,
});
