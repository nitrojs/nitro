// WinterJS (v1.1.5) implements the WinterCG API surface, except that its `Response`
// constructor rejects a `null` body and a nullish `status`, both valid per spec.
// https://github.com/wasmerio/winterjs
const NativeResponse = globalThis.Response;

globalThis.Response = class Response extends NativeResponse {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body === null ? undefined : body, init?.status == null ? { ...init, status: 200 } : init);
  }
} as typeof globalThis.Response;
