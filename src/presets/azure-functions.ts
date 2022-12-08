import { createWriteStream } from "node:fs";
import archiver from "archiver";
import { join, resolve } from "pathe";
import { writeFile } from "../utils";
import { defineNitroPreset } from "../preset";
import type { Nitro } from "../types";

export const azureFunctions = defineNitroPreset({
  serveStatic: true,
  entry: "#internal/nitro/entries/azure-functions",
  commands: {
    deploy:
      "az functionapp deployment source config-zip -g <resource-group> -n <app-name> --src {{ output.dir }}/deploy.zip",
  },
  hooks: {
    async compiled(ctx: Nitro) {
      await writeRoutes(ctx);
    },
  },
});

function zipDirectory(dir: string, outfile: string): Promise<undefined> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = createWriteStream(outfile);

  return new Promise((resolve, reject) => {
    archive
      .directory(dir, false)
      .on("error", (err: Error) => reject(err))
      .pipe(stream);

    stream.on("close", () => resolve(undefined));
    archive.finalize();
  });
}

async function writeRoutes(nitro: Nitro) {
  const host = {
    version: "2.0",
    extensions: { http: { routePrefix: "" } },
  };

  const functionDefinition = {
    entryPoint: "handle",
    bindings: [
      {
        authLevel: "anonymous",
        type: "httpTrigger",
        direction: "in",
        name: "req",
        route: "{*url}",
        methods: ["delete", "get", "head", "options", "patch", "post", "put"],
      },
      {
        type: "http",
        direction: "out",
        name: "res",
      },
    ],
  };

  await writeFile(
    resolve(nitro.options.output.serverDir, "function.json"),
    JSON.stringify(functionDefinition)
  );
  await writeFile(
    resolve(nitro.options.output.dir, "host.json"),
    JSON.stringify(host)
  );
  await zipDirectory(
    nitro.options.output.dir,
    join(nitro.options.output.dir, "deploy.zip")
  );
}
