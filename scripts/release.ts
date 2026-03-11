#!/bin/env node
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  allowNegative: true,
  options: {
    tests: { type: "boolean", default: true },
  },
});

const c = {
  cyan: (s: string) => `\x1B[36m${s}\x1B[0m`,
  green: (s: string) => `\x1B[32m${s}\x1B[0m`,
  red: (s: string) => `\x1B[31m${s}\x1B[0m`,
  bold: (s: string) => `\x1B[1m${s}\x1B[0m`,
  gray: (s: string) => `\x1B[90m${s}\x1B[0m`,
};

function run(cmd: string, opts?: { silent?: boolean }) {
  console.log(c.gray(`$ ${cmd}`));
  return execSync(cmd, {
    stdio: opts?.silent ? "pipe" : "inherit",
    encoding: "utf8",
  });
}

async function main() {
  console.log(c.bold("\n🚀 Nitro Release\n"));

  // 1. Test
  if (!args.tests) {
    console.log(c.gray("→ Skipping tests (--no-tests)\n"));
  } else {
    console.log(c.cyan("→ Running tests...\n"));
    run("pnpm test");
  }

  // 2. Build
  console.log(c.cyan("\n→ Building...\n"));
  run("pnpm build");

  // 3. Bump version
  console.log(c.cyan("\n→ Bumping version...\n"));
  run("node scripts/bump-version.ts");

  // 4. Generate release notes
  console.log(c.cyan("\n→ Generating release notes...\n"));
  run("pnpx changelogen --output CHANGELOG.md");
  console.log(c.green("  Written to CHANGELOG.md"));
  execSync("code CHANGELOG.md", { stdio: "ignore" });

  console.log(c.green(c.bold("\n✅ Release prepared!\n")));
}

main().catch((error) => {
  console.error(c.red(`\nError: ${error.message}\n`));
  process.exit(1);
});
