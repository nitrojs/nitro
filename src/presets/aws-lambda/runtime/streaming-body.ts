/**
 * Decide how the aws-lambda streaming handler should emit a fetch Response.
 *
 * Bodyless responses (redirects, 204/304, handlers that return `new Response(null)`)
 * must write status+headers and end the stream immediately. Forcing
 * `transfer-encoding: chunked` and writing a zero-length chunk hangs the
 * response behind CloudFront until the Lambda times out.
 */
export type StreamingEmitPlan =
  | { kind: "bodyless"; contentLength: "0" }
  | { kind: "stream"; transferEncoding: "chunked" | undefined };

export function planAwsLambdaStreamingEmit(response: {
  body: ReadableStream | null;
  headers?: { get?(name: string): string | null };
}): StreamingEmitPlan {
  if (!response.body) {
    return { kind: "bodyless", contentLength: "0" };
  }
  const existingTE =
    response.headers?.get?.("transfer-encoding") ||
    response.headers?.get?.("Transfer-Encoding");
  return {
    kind: "stream",
    transferEncoding: existingTE ? undefined : "chunked",
  };
}
