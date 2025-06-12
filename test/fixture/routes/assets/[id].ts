import { HTTPError } from "h3";

export default defineHandler(async (event) => {
  const serverAssets = useStorage("assets/server");

  const id = event.context.params.id;

  if (!(await serverAssets.hasItem(id))) {
    throw new HTTPError({ message: `Asset ${id} not found`, status: 404 });
  }

  const meta = (await serverAssets.getMeta(
    event.context.params.id
  )) as unknown as { type: string; etag: string; mtime: string };

  if (meta.type) {
    setResponseHeader(event, "content-type", meta.type);
  }

  if (meta.etag) {
    setResponseHeader(event, "etag", meta.etag);
  }

  if (meta.mtime) {
    setResponseHeader(event, "last-modified", meta.mtime);
  }

  return serverAssets.getItemRaw(event.context.params.id);
});
