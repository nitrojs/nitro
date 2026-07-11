import { defineHandler } from "nitro";
import { container, text } from "takumi-js/helpers";
import ImageResponse from "takumi-js/response";

export default defineHandler((event) => {
  const url = new URL(event.req.url);
  const title = url.searchParams.get("title") ?? "Takumi + Nitro";
  const description = url.searchParams.get("description") ?? "Render OG images from a Nitro route.";

  return new ImageResponse(
    container({
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "64px",
        backgroundImage: "linear-gradient(to bottom right, #fff1f2, #fecdd3)",
      },
      children: [
        text(title, { fontSize: 72, fontWeight: 700, color: "#111827" }),
        text(description, { fontSize: 42, fontWeight: 500, color: "#4b5563" }),
      ],
    }),
    {
      width: 1200,
      height: 630,
    }
  );
});
