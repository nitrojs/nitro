import { fileURLToPath } from "mlly";
import { createNitro, writeTypes } from "nitro/builder";
import { resolve } from "pathe";
import { scanHandlers } from "../../src/scan";

const prepare = async () => {
  const fixtureDir = fileURLToPath(new URL("../fixture", import.meta.url).href);

  const nitro = await createNitro({
    rootDir: fixtureDir,
    serveStatic: true,
    output: { dir: resolve(fixtureDir, ".output", "types") },
  });

  await scanHandlers(nitro);
  await writeTypes(nitro);
};

prepare();
