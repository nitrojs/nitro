import { readFile } from "node:fs/promises";
import { parenURL } from "./_asset-url-paren.ts";

export default async () => {
  const url = new URL("../files/test.txt", import.meta.url);
  // prettier-ignore
  const again = new URL(
    `../files/test.txt`,
    import.meta.url,
  );
  return {
    file: url.pathname.split("/").pop(),
    text: await readFile(url, "utf8"),
    same: url.href === again.href && url.href === parenURL.href,
    source: 'new URL("../files/test.txt", import.meta.url)',
  };
};
