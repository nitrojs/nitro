import errorHandler from "./error";

export default defineNitroConfig({
  compatibilityDate: "2025-03-01",
  errorHandler: "~/error",
  devErrorHandler: errorHandler,
});
