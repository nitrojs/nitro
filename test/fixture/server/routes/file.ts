import { defineHandler, getQuery } from "nitro/h3";

import { useStorage } from "nitro/runtime";

export default defineHandler(async (event) => {
  const query = getQuery(event);
  const filename = query?.filename || "index.html";
  const serverAsset = await useStorage().getItem(`assets/files/${filename}`);
  return serverAsset;
});
