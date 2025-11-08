export default async () => {
  const md = await import("../../assets/test.md" as string).then(
    (r) => r.default
  );
  return md;
};
