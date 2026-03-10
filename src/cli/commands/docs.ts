import { execSync } from "node:child_process";
import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "docs",
    description: "Explore Nitro documentation",
  },
  args: {
    page: { type: "string", description: "Page path to open" },
  },
  run({ rawArgs }) {
    const runner = (
      [
        ["bun", "x"],
        ["pnpm", "dlx"],
        ["npm", "x"],
      ] as const
    ).find(([pkg]) => {
      try {
        execSync(`${pkg} -v`, { stdio: "ignore" });
        return true;
      } catch {}
    }) || ["npm", "x"];
    const runnerCmd = runner.join(" ");
    const docsDir = new URL("../../../skills/nitro/docs", import.meta.url).pathname;
    const args = rawArgs?.join(" ") || "";
    execSync(`${runnerCmd} mdzilla ${docsDir}${args ? ` ${args}` : ""}`, {
      stdio: "inherit",
    });
  },
});
