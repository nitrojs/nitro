export default {
  input: ["README.md", "docs/**/*.md"],
  generators: {
    compatDate: {
      async generate(ctx) {
        const { compatibilityChanges } = await import("./src/meta/index.ts");

        const table = [
          "| Compatibility date | Platform | Description |",
          "|------|----------|-------------|",
          ...compatibilityChanges.map(
            (change) =>
              `| **≥ ${change.from}** | ${change.platform} | ${change.description} |`
          ),
        ];

        return {
          contents: table.join("\n"),
        };
      },
    },
  },
};
