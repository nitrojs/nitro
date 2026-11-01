// @ts-ignore
import depA from "@fixture/nitro-dep-a";
// @ts-ignore
import depB from "@fixture/nitro-dep-b";
// @ts-ignore
import depLib from "@fixture/nitro-lib";
// @ts-ignore
import subpathLib from "@fixture/nitro-lib/subpath";
// @ts-ignore
import extraUtils from "@fixture/nitro-utils/extra";
// @ts-ignore
import cjsRequirer from "nitro-cjs-requirer";
// @ts-ignore
import bundledDep from "nitro-bundled-dep";
// @ts-ignore
import cjsNestedRequirer from "nitro-cjs-nested-requirer";
// @ts-ignore
import cjsShadowedRequirer from "nitro-cjs-shadowed-requirer";

export default () => {
  return {
    depA, // expected to all be 1.0.0
    depB, // expected to all be 2.0.1
    depLib, // expected to all be 2.0.0
    subpathLib, // expected to 2.0.0
    extraUtils,
    cjsRequirer,
    bundledDep, // expected to be 3.0.0
    cjsNestedRequirer, // expected to be 4.0.0
    cjsShadowedRequirer: cjsShadowedRequirer.lib, // expected to be 5.0.0
  };
};
