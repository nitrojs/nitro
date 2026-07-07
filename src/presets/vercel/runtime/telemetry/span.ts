import type {
  IKeyValue,
  ISpan,
  ISpanEvent,
  SpanInfo,
} from "./types.ts";

// OTLP `Status.StatusCode` (proto enum): UNSET = 0, OK = 1, ERROR = 2.
const STATUS_CODE_ERROR = 2;

/**
 * A single OTLP span. Declared as a class (fixed shape, shared prototype) so
 * every span is the same hidden class — cheaper to build and serialize than ad
 * hoc literals. The Vercel runtime validates the payload strictly, so every
 * OTLP field is present even when empty (omitting e.g. `events` or `attributes`
 * makes the runtime drop the whole batch).
 */
export class Span implements ISpan {
  traceId: string;
  spanId: string;
  // Parent on the platform root so spans appear as flat siblings.
  parentSpanId: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  traceState = "";
  droppedAttributesCount = 0;
  events: ISpanEvent[];
  droppedEventsCount = 0;
  links: never[] = [];
  droppedLinksCount = 0;
  attributes: IKeyValue[];
  status: { code: number; message: string };

  constructor(
    traceId: string,
    parentSpanId: string,
    info: SpanInfo,
    startTimeUnixNano: string,
    error: unknown
  ) {
    this.traceId = traceId;
    this.spanId = Span.randomSpanId();
    this.parentSpanId = parentSpanId;
    this.name = info.name;
    this.kind = info.kind;
    this.attributes = info.attributes;
    this.startTimeUnixNano = startTimeUnixNano;
    this.endTimeUnixNano = Span.nowUnixNano();
    if (error === undefined) {
      this.status = { code: 0, message: "" };
      this.events = [];
    } else {
      const err = error as Partial<Error> | undefined;
      const message = typeof err?.message === "string" ? err.message : String(error);
      this.status = { code: STATUS_CODE_ERROR, message };

      // OTEL exception semconv: record the error as an `exception` span event so
      // backends surface its type/message/stacktrace, not just an error status.
      const attributes: IKeyValue[] = [];
      if (typeof err?.name === "string") {
        attributes.push({ key: "exception.type", value: { stringValue: err.name } });
      }
      attributes.push({ key: "exception.message", value: { stringValue: message } });
      if (typeof err?.stack === "string") {
        attributes.push({ key: "exception.stacktrace", value: { stringValue: err.stack } });
      }
      this.events = [
        {
          timeUnixNano: this.endTimeUnixNano,
          name: "exception",
          attributes,
          droppedAttributesCount: 0,
        },
      ];
    }
  }

  /** Wall-clock nanoseconds as a string, as required by OTLP `*UnixNano` fields. */
  static nowUnixNano(): string {
    const ms = performance.timeOrigin + performance.now();
    return (BigInt(Math.trunc(ms)) * 1_000_000n + BigInt(Math.round((ms % 1) * 1e6))).toString();
  }

  /** 8 random bytes, hex-encoded — an OTLP span id (never the all-zero sentinel). */
  static randomSpanId(): string {
    let id = "";
    for (let i = 0; i < 8; i++) {
      id += Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0");
    }
    return id === "0000000000000000" ? "0000000000000001" : id;
  }
}


