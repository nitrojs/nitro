import { writeFile } from "node:fs/promises";

const platforms = {
  cloudflare: "https://platform-node-compat.pi0.workers.dev/?ts",
  // Deno deploy and Netlify edge are almost identical
  deno: "https://platform-node-compat.deno.dev/?ts",
  netlify: "https://platform-node-compat.netlify.app/?ts",
};

for (const platform in platforms) {
  const url = platforms[platform as keyof typeof platforms];
  const code = await fetch(url).then((res) => res.text());

  console.log(
    `Fetching Node.js compatibility data for ${platform} from ${url}`
  );

  await writeFile(
    new URL(
      `../src/presets/_unenv/node-compat/${platform}.ts`,
      import.meta.url
    ),
    code
  );
}
