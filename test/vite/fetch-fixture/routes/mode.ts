export default ({ req }: { req: Request }) => ({ dev: import.meta.dev, url: req.url });
