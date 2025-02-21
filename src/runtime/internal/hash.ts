import { digest, serialize } from "ohash";

// hash implementation compatible with ohash v1 to reduce cache invalidation in same semver Nitro versions

export function hash(value: any) {
  return digest(compatSerialize(value)).replace(/[-_]/g, "").slice(0, 10);
}

function compatSerialize(value: any): string {
  if (value === null) {
    return "Null";
  }
  const type = typeof value;
  if (type === "string") {
    return value;
  }
  if (type === "number") {
    return `number:${value}`;
  }
  if (type === "boolean") {
    return `bool:${value}`;
  }
  if (type === "undefined") {
    return "Undefined";
  }
  const serialized = serialize(value);
  if (serialized === "{}") {
    return "object:0:";
  }
  return serialized;
}
