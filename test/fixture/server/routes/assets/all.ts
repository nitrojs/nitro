import { useStorage } from "nitro/storage";

export default async () => {
  const serverAssets = useStorage("assets/server");

  const keys = await serverAssets.getKeys();
  const items = await Promise.all(
    keys.map(async (key) => {
      return {
        key,
        meta: await serverAssets.getMeta(key),
        data: await serverAssets.getItem(key).then((r) =>
          // prettier-ignore
          typeof r === "string" ? r.slice(0, 32) : (isPureObject(r) ? r : `<data>`)
        ),
      };
    })
  );

  return items;
};

function isPureObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && value.constructor === Object;
}
