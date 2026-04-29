import { setCachedError } from "../utils/cached-error-state";

export default defineEventHandler((event) => {
  const { error } = getQuery(event);
  setCachedError(error === "true");
  return { shouldError: error === "true" };
});
