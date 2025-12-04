import { describe, it, expect } from "vitest";
import { createNitro, build, prepare } from "nitro/builder";
import { fileURLToPath } from "node:url";
import { resolve, join } from "pathe";
import { readFile, rm, mkdir } from "node:fs/promises";

const fixtureDir = fileURLToPath(new URL("./", import.meta.url));
const tmpDir = fileURLToPath(new URL(".tmp", import.meta.url));

describe("cloudflare fixture", () => {
    const presets = [
        "cloudflare-module",
        "cloudflare-pages",
        "cloudflare-durable",
    ];

    for (const preset of presets) {
        it(`includes cloudflare.ts exports for ${preset}`, async () => {
            const outDir = join(tmpDir, preset);
            await rm(outDir, { recursive: true, force: true });
            await mkdir(outDir, { recursive: true });

            const nitro = await createNitro({
                rootDir: fixtureDir,
                preset: preset,
                output: { dir: outDir },
            });
            await prepare(nitro);
            await build(nitro);

            const entryPath =
                preset === "cloudflare-pages"
                    ? resolve(outDir, "_worker.js/index.js")
                    : resolve(outDir, "server/index.mjs");

            const entry = await readFile(entryPath, "utf8");
            expect(entry).toMatch(/export \{.*myScheduled.*\}/);
        });
    }
});
