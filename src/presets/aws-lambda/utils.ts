export const awsLambdaPreviewShim = `globalThis.awslambda ??= {
  streamifyResponse(handler) {
    return handler;
  },
  HttpResponseStream: {
    from(stream) {
      return stream;
    },
  },
};
`;
