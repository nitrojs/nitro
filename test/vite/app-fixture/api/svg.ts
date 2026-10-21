// @ts-ignore
import text from "./icon.svg" with { type: "text" };
// @ts-ignore
import bytes from "./icon.svg" with { type: "bytes" };
// @ts-ignore
import raw from "raw:./icon.svg";

export default () => ({
  text: (text as unknown as string).trim(),
  bytes: new TextDecoder().decode(bytes as unknown as Uint8Array).trim(),
  // `raw:` infers the type from the mime (`image/svg+xml` is binary)
  raw: new TextDecoder().decode(raw as unknown as Uint8Array).trim(),
});
