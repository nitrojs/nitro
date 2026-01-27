export default async () => {
  const md = await import("raw:../../assets/test.md" as string).then((r) => r.default);
  return md;
};
