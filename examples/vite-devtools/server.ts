export default ({ req }: { req: Request }) => {
  console.log(`[${req.method}] ${req.url}`);
};
