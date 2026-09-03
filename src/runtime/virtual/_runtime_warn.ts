import consola from "consola";

const env: Record<string, string | undefined> | undefined = globalThis.process?.env;
const isTest: boolean = env?.NODE_ENV === "test" || !!env?.TEST;

if (!isTest) {
  consola.warn(
    "Nitro runtime imports detected without a builder or Nitro plugin. A stub implementation will be used."
  );
}
