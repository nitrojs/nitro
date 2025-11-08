export default async () => {
  return {
    stack: new Error("testing error").stack!.replace(/\\/g, "/"),
  };
};
