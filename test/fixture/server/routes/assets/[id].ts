import { defineHandler, HTTPError } from "nitro/h3";
import { useStorage } from "nitro/storage";

export default defineHandler(async (event) => {
  const serverAssets = useStorage("assets/server");

  const id = event.context.params!.id;

  if (!(await serverAssets.hasItem(id))) {
    throw new HTTPError({ message: `Asset ${id} not found`, status: 404 });
  }

  const meta = (await serverAssets.getMeta(event.context.params!.id)) as unknown as {
    type: string;
    etag: string;
    mtime: string;
  };

  if (meta.type) {
    event.res.headers.set("content-type", meta.type);
  }

  if (meta.etag) {
    event.res.headers.set("etag", meta.etag);
  }

  if (meta.mtime) {
    event.res.headers.set("last-modified", meta.mtime);
  }

  return serverAssets.getItemRaw(event.context.params!.id);
});
