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
      await new Promise((r) => setTimeout(r, 1000)); // simulate latency
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      if (searchParams.has("text")) {
        return new Response(randomQuote.quoteText);
      }
      return Response.json({
        text: randomQuote.quoteText,
        author: randomQuote.quoteAuthor,
      });
    }
  },
};
