import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const VERCEL_API = "https://api.vercel.com";
const OUTPUT_DIR = ".vercel/output";

// --- Helpers ---

async function walkDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function buildFileEntry(basedir: string, filePath: string) {
  const rel = relative(basedir, filePath);
  const content = await readFile(filePath);
  // Detect binary files by checking for non-text bytes
  const isBinary = content.some(
    (b) => b === 0 || (b < 32 && b !== 9 && b !== 10 && b !== 13),
  );
  return {
    file: rel,
    data: isBinary ? content.toString("base64") : content.toString("utf-8"),
    encoding: isBinary ? ("base64" as const) : ("utf-8" as const),
  };
}

async function vercelFetch(
  path: string,
  opts: { method?: string; body?: unknown; token: string; teamId?: string },
) {
  const url = new URL(path, VERCEL_API);
  if (opts.teamId) {
    url.searchParams.set("teamId", opts.teamId);
  }
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel API error ${res.status}: ${text}`);
  }
  return res.json();
}

// --- Main ---

async function deploy() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error("Missing VERCEL_TOKEN environment variable");
    process.exit(1);
  }

  const projectName = process.env.VERCEL_PROJECT || "nitro-playground";
  const teamId = process.env.VERCEL_TEAM_ID;

  // Check if .vercel/output exists, if not build with vercel preset
  const outputDir = join(import.meta.dirname, OUTPUT_DIR);
  try {
    await stat(outputDir);
    console.log(`Using existing build output: ${outputDir}`);
  } catch {
    console.log("Building with vercel preset...");
    const { execSync } = await import("node:child_process");
    execSync("npx nitro build --preset vercel", {
      cwd: import.meta.dirname,
      stdio: "inherit",
    });
  }

  // Walk all files in .vercel/output
  console.log("Collecting files...");
  const filePaths = await walkDir(outputDir);
  const files = await Promise.all(
    filePaths.map((fp) => buildFileEntry(outputDir, fp)),
  );

  console.log(`Found ${files.length} files:`);
  for (const f of files) {
    const size = Buffer.byteLength(f.data, f.encoding);
    console.log(`  ${f.file} (${size} bytes, ${f.encoding})`);
  }

  // Create deployment
  console.log(`\nDeploying "${projectName}"...`);
  const deployment = await vercelFetch("/v13/deployments", {
    method: "POST",
    token,
    teamId,
    body: {
      name: projectName,
      files,
      projectSettings: {
        framework: null,
        buildCommand: "",
        outputDirectory: "",
        installCommand: "",
      },
    },
  });

  console.log(`\nDeployment created!`);
  console.log(`  ID:     ${deployment.id}`);
  console.log(`  URL:    https://${deployment.url}`);
  console.log(`  State:  ${deployment.readyState}`);

  // Poll for ready state
  if (deployment.readyState !== "READY") {
    console.log("\nWaiting for deployment to be ready...");
    let state = deployment.readyState;
    while (state !== "READY" && state !== "ERROR" && state !== "CANCELED") {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await vercelFetch(
        `/v13/deployments/${deployment.id}`,
        { token, teamId },
      );
      state = status.readyState;
      process.stdout.write(`  ${state}...`);
    }
    console.log();
    if (state === "READY") {
      console.log(`Deployment is live: https://${deployment.url}`);
    } else {
      console.error(`Deployment failed with state: ${state}`);
      process.exit(1);
    }
  }
}

deploy().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
