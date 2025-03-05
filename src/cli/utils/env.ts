import consola from "consola";

export function overrideEnv(targetEnv: string) {
  const currentEnv = process.env.NODE_ENV;
  if (currentEnv && currentEnv !== targetEnv) {
    consola.warn(
      `Changing \`NODE_ENV\` from \`${currentEnv}\` to \`${targetEnv}\`, to avoid unintended behavior.`
    );
  }

  process.env.NODE_ENV = targetEnv;
}
