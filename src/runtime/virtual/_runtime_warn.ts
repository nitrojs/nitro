import consola from "consola";
import { isTest } from "std-env";

if (!isTest) {
  consola.warn(
    "Nitro runtime imports detected without a builder or Nitro plugin. A stub implementation will be used."
  );
}
