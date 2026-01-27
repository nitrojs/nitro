import type { ChangelogConfig } from "changelogen";

export default {
  output: false,
  types: {
    presets: { title: "Preset Changes", semver: "patch" },
  },
} satisfies Partial<ChangelogConfig>;
