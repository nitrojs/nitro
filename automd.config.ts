import type { Config } from "automd";

export default {
  input: ["README.md", "docs/**/*.md"],
  generators: {
    compatDate: {
      name: "compatDate",
      async generate(ctx) {
        // const { compatibilityChanges } = await import("./lib/meta.mjs");

        // const table = [
        //   "| Compatibility date | Platform | Description |",
        //   "|------|----------|-------------|",
        //   ...compatibilityChanges.map(
        //     (change) =>
        //       `| **≥ ${change.from}** | ${change.platform} | ${change.description} |`
        //   ),
        // ];
        return {
          // contents: table.join("\n"),
          contents: "",
        };
      },
    },
  },
} satisfies Config;
