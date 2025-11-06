import conf from "~/nitro.config";
export default {
  fetch(req: Request) {
    console.log("Nitro config:", conf);
    return new Response("Hello from Nitro playground!");
  },
};
