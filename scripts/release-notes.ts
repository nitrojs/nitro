#!/bin/env node
import { execSync } from "node:child_process";
import { generateMarkDown, getGitDiff, loadChangelogConfig, parseCommits } from "changelogen";

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/release-notes.ts <tag>");
  process.exit(1);
}

const from = execSync(`git describe --tags --abbrev=0 "${to}^"`, { encoding: "utf8" }).trim();

const config = await loadChangelogConfig(process.cwd(), { from, to, noAuthors: true });
const commits = parseCommits(await getGitDiff(from, to), config)
  .map((c) => ({ ...c, type: c.type.toLowerCase() }))
  .filter(
    (c) => config.types[c.type] && !(c.type === "chore" && c.scope === "deps" && !c.isBreaking)
  );

const markdown = (await generateMarkDown(commits, config)).replace(/^\s*## .*\n/, "").trim();

const contributors = getContributors(commits.map((c) => c.shortHash));

process.stdout.write(
  [markdown, contributors.length > 0 && `### ❤️ Contributors\n\n${contributors.join("\n")}`]
    .filter(Boolean)
    .join("\n\n") + "\n"
);

function getContributors(hashes: string[]): string[] {
  const out = execSync(
    `gh api --paginate "repos/${config.repo!.repo}/compare/${from}...${to}?per_page=100" --jq '.commits[] | [.sha, .author.login // "", .author.type // "", .commit.author.name] | @tsv'`,
    { encoding: "utf8" }
  );
  const contributors = new Set<string>();
  for (const line of out.trim().split("\n")) {
    const [sha, login, type, name] = line.split("\t");
    if (!hashes.some((h) => sha.startsWith(h)) || type === "Bot" || name.includes("[bot]")) {
      continue;
    }
    contributors.add(login ? `- @${login}` : `- ${name}`);
  }
  return [...contributors];
}
