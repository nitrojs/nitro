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

export default () => {
  return {
    depA, // expected to all be 1.0.0
    depB, // expected to all be 2.0.1
    depLib, // expected to all be 2.0.0
    subpathLib, // expected to 2.0.0
    extraUtils,
  };
};
