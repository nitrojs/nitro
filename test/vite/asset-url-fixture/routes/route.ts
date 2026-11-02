import { readFile } from "node:fs/promises";
// Other assets of server code are not written to the server output
import "../files/style.css";

export default async () => {
  const url = new URL("../files/route.txt", import.meta.url);
  return { href: url.href, text: await readFile(url, "utf8") };
};
