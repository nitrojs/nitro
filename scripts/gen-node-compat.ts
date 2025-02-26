import { writeFile } from "node:fs/promises";

const platforms = {
  cloudflare: {
    url: "https://platform-node-compat.pi0.workers.dev/?json",
    forceHybrid: ["async_hooks", "console", "perf_hooks"],
    forceBuiltin: ["assert", "assert/strict", "events", "net", "stream"],
  },
  deno: {
    url: "https://platform-node-compat.deno.dev/?json",
    forceBuiltin: true,
  },
  netlify: {
    url: "https://platform-node-compat.netlify.app/?json",
    forceBuiltin: true,
  },
  vercel: {
    url: "https://platform-node-compat.vercel.app/?json",
    forceBuiltin: ["assert", "assert/strict", "events", "net", "stream"],
  },
} as {
  [platform: string]: {
    url: string;
    forceHybrid?: string[];
    forceBuiltin?: true | string[];
  };
};

type NodeComptatReport = {
  _url: string;
  version: string;
  globals: {
    globalKeys: string[];
    missing: string[];
  };
  builtinModules: Record<
    string,
    | false
    | {
        exports: string[];
        missingExports: string[];
      }
  >;
};

for (const [platformName, { url, forceHybrid, forceBuiltin }] of Object.entries(
  platforms
)) {
  const report = (await fetch(url).then((res) =>
    res.json()
  )) as NodeComptatReport;

  const builtnNodeModules: [string, string[]][] = [];

  const hybridNodeCompatModules: [string, string[]][] = [];

  const notSupported: string[] = [];

  for (const [id, status] of Object.entries(report.builtinModules)) {
    if (!status) {
      if (forceHybrid?.includes(id)) {
        hybridNodeCompatModules.push([id, []]);
      } else {
        notSupported.push(id);
      }
      continue;
    }

    const missingExports = status.missingExports.filter(
      (exp) => !exp.startsWith("_")
    );

    let target =
      missingExports.length === 0 ? builtnNodeModules : hybridNodeCompatModules;
    if (forceHybrid?.includes(id)) {
      target = hybridNodeCompatModules;
    }
    if (forceBuiltin === true || forceBuiltin?.includes(id)) {
      target = builtnNodeModules;
    }

    target.push([id, missingExports]);
  }

  const code = /* js */ `
// Auto generated using gen-node-compat.ts on ${new Date().toISOString()}
// Source: ${url.replace(/\?json$/, "")}
// Do not edit this file manually

export const builtnNodeModules = [
${builtnNodeModules
  .sort()
  .map(([id, missing]) =>
    missing.length > 0
      ? `  "${id}", // Missing exports: ${missing.join(", ")}`
      : `  "${id}",`
  )
  .join("\n")}
];

export const hybridNodeModules = [
${hybridNodeCompatModules
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([id, missing]) =>
    missing.length > 0
      ? `  "${id}", // Missing exports: ${missing.join(", ")}`
      : `  "${id}",`
  )
  .join("\n")}
];

export const unsupportedNodeModules = [
${notSupported.map((id) => `  "${id}",`).join("\n")}
];
`;

  await writeFile(
    new URL(
      `../src/presets/${platformName}/unenv/node-compat.ts`,
      import.meta.url
    ),
    code
  );
}

export {};
