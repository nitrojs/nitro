export default ({ mode }: { mode?: string }) => ({
  worker: { name: `app-${mode}`, compatibilityDate: "2025-01-01" },
});
