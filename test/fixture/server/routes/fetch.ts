export default defineHandler(async (event) => {
  const nitroApp = useNitroApp();
  return {
    $fetch: await $fetch("/api/hey"),
    // Removed in v3
    // "event.fetch": await event.fetch("/api/hey").then((r) => r.text()),
    // "event.$fetch": await event.$fetch("/api/hey"),
    "nitroApp.localFetch": await nitroApp
      .request("/api/hey")
      .then((r) => r.text()),
  };
});
