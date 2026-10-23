export default () => {
  const res = new Response("fast response", { headers: { "x-init": "1" } });
  res.headers.set(
    "x-fast-response",
    JSON.stringify({
      fast: typeof (res as any)._toNodeResponse === "function",
      instanceOf: res instanceof Response,
    })
  );
  return res;
};
