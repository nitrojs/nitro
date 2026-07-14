// https://github.com/tc39/proposal-import-bytes
// https://github.com/tc39/proposal-import-text

// @ts-ignore
import bin from "../files/bytes.bin" with { type: "bytes" };

// The file type is ignored: text files can be imported as bytes and json as text
// @ts-ignore
import sql from "../files/sql.sql" with { type: "bytes" };
// @ts-ignore
import json from "../assets/test.json" with { type: "text" };

// `export ... from ... with { type: "..." }` goes through the same path
import { reexportedText, reexportedBytes } from "./_import-attributes-reexport.ts";

// Source files imported as text must keep their contents, attribute syntax included
// @ts-ignore
import source from "./_import-attributes-reexport.ts" with { type: "text" };

export default async () => {
  // TypeScript has no `bytes` and `text` attribute support yet and types imports by file type
  const jsonText = json as unknown as string;
  const sourceText = source as unknown as string;

  const txtBytes = (await import("../files/test.txt", { with: { type: "bytes" } }).then(
    (r) => r.default
  )) as unknown as Uint8Array;

  const txt: string = await import("../files/test.txt", { with: { type: "text" } }).then(
    (r) => r.default
  );

  return {
    bin: {
      isUint8Array: bin instanceof Uint8Array,
      // All 256 byte values, unchanged
      bytes: [...bin].join(","),
    },
    sql: {
      isUint8Array: sql instanceof Uint8Array,
      text: new TextDecoder().decode(sql).trim(),
    },
    json: {
      isString: typeof jsonText === "string",
      text: jsonText.trim(),
    },
    txtBytes: {
      isUint8Array: txtBytes instanceof Uint8Array,
      text: new TextDecoder().decode(txtBytes).trim(),
    },
    txt: {
      isString: typeof txt === "string",
      text: txt.trim(),
    },
    reexported: {
      isString: typeof reexportedText === "string",
      text: (reexportedText as unknown as string).trim(),
      isUint8Array: (reexportedBytes as unknown) instanceof Uint8Array,
      bytesText: new TextDecoder().decode(reexportedBytes as unknown as Uint8Array).trim(),
    },
    source: {
      verbatim: sourceText.includes('from "../files/test.txt" with { type: "text" }'),
      rewritten: sourceText.includes('"text:../files/test.txt"'),
    },
  };
};
