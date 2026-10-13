// @ts-ignore
import pre from "#order-pre";
// @ts-ignore
import normal from "#order-normal";
// @ts-ignore
import post from "#order-post";
// @ts-ignore
import module from "virtual:module";
// @ts-ignore
import promise from "virtual:promise";

export default {
  fetch(_req: Request) {
    return Response.json({ pre, normal, post, module, promise });
  },
};
