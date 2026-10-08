import { defineHandler, getQuery } from "nitro/h3";

import { useKV } from "nitro/kv";

export default defineHandler(async (event) => {
  const query = getQuery(event);
  const filename = query?.filename || "index.html";
  const serverAsset = await useKV().getItem(`assets/files/${filename}`);
  return serverAsset;
});
