// A helper named `fetch`, shared with a lazy chunk. It must never be picked as a service handler,
// neither as an explicit named export next to the real handler nor when a bundler hoists it onto
// the entry chunk (`preserveEntrySignatures`).
export const fetch = () => new Response("helper");
