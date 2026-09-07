// A perfectly healthy route that has nothing to do with the throwing one.
// It must keep working even when a sibling route throws at import time.
export default defineEventHandler(() => {
  return { ok: true };
});
