#!/bin/env node
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
// import { setTimeout as sleep } from "node:timers/promises";

const { values: args } = parseArgs({
  allowNegative: true,
  options: {
    precheck: { type: "boolean", default: true },
  },
});

const c = {
  cyan: (s: string) => `\x1B[36m${s}\x1B[0m`,
  green: (s: string) => `\x1B[32m${s}\x1B[0m`,
  red: (s: string) => `\x1B[31m${s}\x1B[0m`,
  bold: (s: string) => `\x1B[1m${s}\x1B[0m`,
  gray: (s: string) => `\x1B[90m${s}\x1B[0m`,
};

main().catch((error) => {
  console.error(c.red(`\nError: ${error.message}\n`));
  process.exit(1);
});

async function main() {
  console.log(c.bold("\n🚀 Nitro Release\n"));

  // 1. Prechecks
  if (!args.precheck) {
    console.log(c.gray("→ Skipping prechecks (--no-precheck)\n"));
  } else {
    await precheck();
  }

  // 2. Bump version
  console.log(c.cyan("\n→ Bumping version...\n"));
  run("node scripts/bump-version.ts");

  // 3. Read new version
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const version = `v${pkg.version}`;
  console.log(c.cyan(`\n→ Version: ${c.bold(version)}\n`));

  // 4. Generate release notes
  console.log(c.cyan("→ Generating release notes...\n"));
  run("pnpx changelogen --output CHANGELOG.md");
  console.log(c.green("  Written to CHANGELOG.md"));

  // 5. Commit and tag
  console.log(c.cyan("\n→ Creating release commit and tag...\n"));
  run("git add package.json");
  run(`git commit -m "${version}"`);
  run(`git tag -a ${version} -m "${version}"`);

  console.log(c.green(c.bold(`\n✅ Release ${version} prepared!\n`)));

  // Prompt to push
  process.stdout.write(c.cyan(`  Push with ${c.bold("git push --follow-tags")}? (yes/no) `));
  const answer = await new Promise<string>((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => resolve(data.toString().trim()));
  });
  process.stdin.destroy();
  if (answer === "yes") {
    run("git push --follow-tags");
    console.log(c.green(c.bold("\n🎉 Released!\n")));
  } else {
    console.log(c.cyan(`\n  Run ${c.bold("git push --follow-tags")} manually to publish.\n`));
  }
}

function run(cmd: string, opts?: { silent?: boolean; quiet?: boolean }) {
  if (!opts?.quiet) {
    console.log(c.gray(`$ ${cmd}`));
  }
  return execSync(cmd, {
    stdio: opts?.silent ? "pipe" : "inherit",
    encoding: "utf8",
  });
}

async function precheck() {
  console.log(c.cyan("→ Running prechecks...\n"));

  // Check we are on main branch
  const branch = run("git rev-parse --abbrev-ref HEAD", { silent: true }).trim();
  if (branch !== "main") {
    throw new Error(`Must be on "main" branch (currently on "${branch}")`);
  }

  // Check no dirty state
  const status = run("git status --porcelain", { silent: true }).trim();
  if (status) {
    throw new Error(`Working tree is dirty:\n${status}`);
  }

  // Check local HEAD matches remote main
  run("git fetch origin main", { silent: true });
  const localHead = run("git rev-parse HEAD", { silent: true }).trim();
  const remoteHead = run("git rev-parse origin/main", { silent: true }).trim();
  if (localHead !== remoteHead) {
    throw new Error(
      `Local HEAD (${localHead.slice(0, 8)}) does not match origin/main (${remoteHead.slice(0, 8)})`
    );
  }

  // Check all GitHub Actions completed successfully for HEAD commit
  // type CIRun = { status: string; conclusion: string; name: string; databaseId: number };
  // type CIJob = { status: string; conclusion: string; name: string };
  // const pollInterval = 15_000;
  // let ciRuns: CIRun[] = [];
  // // eslint-disable-next-line no-constant-condition
  // while (true) {
  //   ciRuns = JSON.parse(
  //     run(
  //       `gh run list --branch main --commit ${remoteHead} --json status,conclusion,name,databaseId`,
  //       { silent: true, quiet: true }
  //     )
  //   ) as CIRun[];
  //   if (ciRuns.length === 0) {
  //     throw new Error("No GitHub Actions runs found for HEAD");
  //   }
  //   const pending = ciRuns.filter((r) => r.status !== "completed");
  //   if (pending.length === 0) break;
  //   console.log(c.gray(`  Waiting for ${pending.map((r) => r.name).join(", ")}...`));
  //   await sleep(pollInterval);
  // }

  // // Fetch jobs for each run and print summary
  // const allFailed: string[] = [];
  // for (const r of ciRuns) {
  //   const jobs = JSON.parse(
  //     run(`gh run view ${r.databaseId} --json jobs -q ".jobs"`, { silent: true, quiet: true })
  //   ) as CIJob[];
  //   const runIcon = r.conclusion === "success" ? c.green("✓") : c.red("✗");
  //   console.log(`  ${runIcon} ${c.bold(r.name)}`);
  //   for (const job of jobs) {
  //     const jobIcon = job.conclusion === "success" ? c.green("✓") : c.red("✗");
  //     console.log(`    ${jobIcon} ${job.name}`);
  //     if (job.conclusion !== "success") {
  //       allFailed.push(`${r.name} > ${job.name} (${job.conclusion})`);
  //     }
  //   }
  // }
  // if (allFailed.length > 0) {
  //   throw new Error(`GitHub Actions failed:\n  ${allFailed.join("\n  ")}`);
  // }

  console.log(c.green("  All prechecks passed!\n"));
}
