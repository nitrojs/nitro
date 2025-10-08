const QUOTES_URL =
  "https://github.com/JamesFT/Database-Quotes-JSON/raw/refs/heads/master/quotes.json";

let _quotes: Promise<unknown> | undefined;

function getQuotes(): Promise<{ quoteText: string; quoteAuthor: string }[]> {
  return (_quotes ??= fetch(QUOTES_URL).then((res) => res.json()));
}

export default {
  async fetch(request: Request) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname === "/quote") {
      const quotes = await getQuotes();
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      if (searchParams.has("text")) {
        return new Response(tokenizedStream(randomQuote.quoteText, 150), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      return Response.json({
        text: randomQuote.quoteText,
        author: randomQuote.quoteAuthor,
      });
    }
  },
};

function tokenizedStream(text: string, delay = 100) {
  const tokens = text.split(" ");
  return new ReadableStream({
    start(controller) {
      let index = 0;
      function push() {
        if (index < tokens.length) {
          const word = tokens[index++] + (index < tokens.length ? " " : "");
          controller.enqueue(new TextEncoder().encode(word));
          setTimeout(push, delay);
        } else {
          controller.close();
        }
      }
      push();
    },
  });
}
