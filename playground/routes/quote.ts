import quotes from "./_quotes.json" with { type: "json" };

export default {
  fetch() {
    const { quoteText: text, quoteAuthor: author } =
      quotes[Math.floor(Math.random() * quotes.length)];
    return Response.json({ text, author });
  },
};
