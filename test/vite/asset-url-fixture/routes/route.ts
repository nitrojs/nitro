import { readFile } from "node:fs/promises";

export default async () => {
  const url = new URL("../files/route.txt", import.meta.url);
  return { href: url.href, text: await readFile(url, "utf8") };
};
