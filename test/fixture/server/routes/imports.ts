import { testBarUtil } from "../utils/foo/bar/test.ts";
import { testFooUtil } from "../utils/foo/test.ts";
import { testUtil } from "../utils/test.ts";

export default () => {
  return {
    testUtil: testUtil(),
    testNestedUtil: testFooUtil() + testBarUtil(),
  };
};
