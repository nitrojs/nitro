class CustomResponse extends Response {}

export default () => {
  const res = new Response("fast response", { headers: { "x-init": "1" } });
  const custom = new CustomResponse("custom");
  res.headers.set(
    "x-fast-response",
    JSON.stringify({
      fast: typeof (res as any)._toNodeResponse === "function",
      statics: Response.error() instanceof Response && Response.json({}) instanceof Response,
      subclass: custom instanceof CustomResponse && !(res instanceof CustomResponse),
    })
  );
  return res;
};
