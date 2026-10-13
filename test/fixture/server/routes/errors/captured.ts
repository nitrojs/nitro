import { allErrors } from "../../plugins/errors.ts";

export default () => {
  return {
    allErrors: allErrors.map((entry) => ({
      message: entry.error.message,
    })),
  };
};
