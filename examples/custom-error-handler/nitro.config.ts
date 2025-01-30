import errorHandler from "./error";

export default defineNitroConfig({
  compatibilityDate: "2025-01-30",
  errorHandler: "~/error",
  devErrorHandler: errorHandler,
});
