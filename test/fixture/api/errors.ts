import { allErrors } from "../plugins/errors";

export default defineHandler((event) => {
  return {
    allErrors: allErrors.map((entry) => ({
      message: entry.error.message,
    })),
  };
});
