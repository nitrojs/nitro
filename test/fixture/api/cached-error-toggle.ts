import { toggleCachedError } from "../utils/cached-error-state";

export default defineEventHandler(() => {
  toggleCachedError();
  return { toggled: true };
});
