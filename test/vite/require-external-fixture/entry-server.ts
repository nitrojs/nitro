import { state } from "@fixture/require-external-dep";
import shim from "./vendor/shim.cjs";

export default {
  fetch() {
    return Response.json({ sameInstance: shim.dep.state === state });
  },
};
