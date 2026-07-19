// This module throws while it is being *evaluated* (import time), not inside
// the handler. Regression guard for the dev server surfacing the real error
// instead of an unrelated `Cannot access '<x>' before initialization` TDZ.
throw new Error("boom_import_time_error");

export default defineEventHandler(() => {
  return { unreachable: true };
});
