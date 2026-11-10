import { fileURLToPath } from "node:url";
import { join } from "pathe";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("MatchedRoutes", () => {
  it("does not exceed the stack depth for a route that is still generic", () => {
    // TypeScript orders union members by when their types were first created, and route matching
    // used to recurse without end when "result" was created before "current", which a program does
    // not control. The fixture's types cannot pin the order, so this checks a program that does.
    // normalized, as TypeScript asks the host for files with forward slashes
    const fileName = join(
      fileURLToPath(new URL(".", import.meta.url)),
      "match-types.probe.ts"
    );
    const code = `
      import type { MatchedRoutes } from "../../src/types/fetch/_match";
      import type { InternalApi } from "../../src/types/fetch/fetch";

      export type LiteralOrder = "result" | "current";

      declare module "../../src/types/fetch/fetch" {
        interface InternalApi {
          "/api/hello": {};
          "/api/users/:id": {};
        }
      }

      export function matchedRoute<R extends string>(): keyof InternalApi {
        return {} as MatchedRoutes<R>;
      }
    `;

    const options: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    };
    const host = ts.createCompilerHost(options);
    const { getSourceFile, fileExists, readFile } = host;
    host.getSourceFile = (name, ...args) =>
      name === fileName
        ? ts.createSourceFile(name, code, ts.ScriptTarget.ESNext)
        : getSourceFile(name, ...args);
    host.fileExists = (name) => name === fileName || fileExists(name);
    host.readFile = (name) => (name === fileName ? code : readFile(name));

    const program = ts.createProgram([fileName], options, host);
    const sourceFile = program.getSourceFile(fileName);
    expect(sourceFile).toBeDefined();
    const diagnostics = program
      .getSemanticDiagnostics(sourceFile)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));

    expect(diagnostics).toEqual([]);
  });
});
