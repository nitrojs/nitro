import { digest } from "ohash";

// Hash implementation compatible with ohash v1 to reduce cache invalidation in same semver Nitro versions
// Source:
// - https://github.com/unjs/ohash/blob/v1/src/object-hash.ts v1 (MIT)
// - https://github.com/puleos/object-hash v3.0.0 (MIT)

const Hasher = /*@__PURE__*/ (() => {
  class Hasher {
    buff = "";
    #context = new Map();

    write(str: string) {
      this.buff += str;
    }

    dispatch(value: any): string | void {
      const type = value === null ? "null" : typeof value;
      return this[type](value);
    }
    object(object: any): string | void {
      if (object && typeof object.toJSON === "function") {
        return this.object(object.toJSON());
      }

      const objString = Object.prototype.toString.call(object);

      let objType = "";
      const objectLength = objString.length;

      // '[object a]'.length === 10, the minimum
      objType =
        objectLength < 10
          ? "unknown:[" + objString + "]"
          : objString.slice(8, objectLength - 1);

      objType = objType.toLowerCase();

      let objectNumber = null;

      if ((objectNumber = this.#context.get(object)) === undefined) {
        this.#context.set(object, this.#context.size);
      } else {
        return this.dispatch("[CIRCULAR:" + objectNumber + "]");
      }

      if (
        typeof Buffer !== "undefined" &&
        Buffer.isBuffer &&
        Buffer.isBuffer(object)
      ) {
        this.write("buffer:");
        return this.write(object.toString("utf8"));
      }

      if (
        objType !== "object" &&
        objType !== "function" &&
        objType !== "asyncfunction"
      ) {
        // @ts-ignore
        if (this[objType]) {
          // @ts-ignore
          this[objType](object);
        } else {
          this.unknown(object, objType);
        }
      } else {
        const keys = Object.keys(object).sort();
        const extraKeys = [] as readonly string[];
        this.write("object:" + (keys.length + extraKeys.length) + ":");
        const dispatchForKey = (key: string) => {
          this.dispatch(key);
          this.write(":");
          this.dispatch(object[key]);
          this.write(",");
        };
        for (const key of keys) {
          dispatchForKey(key);
        }
        for (const key of extraKeys) {
          dispatchForKey(key);
        }
      }
    }
    array(arr: any, unordered: boolean): string | void {
      unordered = unordered === undefined ? false : unordered;
      this.write("array:" + arr.length + ":");
      if (!unordered || arr.length <= 1) {
        for (const entry of arr) {
          this.dispatch(entry);
        }
        return;
      }
      const contextAdditions = new Map();
      const entries = arr.map((entry: any) => {
        const hasher = new Hasher();
        hasher.dispatch(entry);
        for (const [key, value] of hasher.#context) {
          contextAdditions.set(key, value);
        }
        return hasher.toString();
      });
      this.#context = contextAdditions;
      entries.sort();
      return this.array(entries, false);
    }
    date(date: any) {
      return this.write("date:" + date.toJSON());
    }
    symbol(sym: any) {
      return this.write("symbol:" + sym.toString());
    }
    unknown(value: any, type: string) {
      this.write(type);
      if (!value) {
        return;
      }
      this.write(":");
      if (value && typeof value.entries === "function") {
        return this.array([...value.entries()], true /* ordered */);
      }
    }
    error(err: any) {
      return this.write("error:" + err.toString());
    }
    boolean(bool: any) {
      return this.write("bool:" + bool);
    }
    string(string: any) {
      this.write("string:" + string.length + ":");
      this.write(string);
    }
    function(fn: any) {
      this.write("fn:");
      if (isNativeFunction(fn)) {
        this.dispatch("[native]");
      } else {
        this.dispatch(fn.toString());
      }
    }
    number(number: any) {
      return this.write("number:" + number);
    }
    null() {
      return this.write("Null");
    }
    undefined() {
      return this.write("Undefined");
    }
    regexp(regex: any) {
      return this.write("regex:" + regex.toString());
    }
    arraybuffer(arr: any) {
      this.write("arraybuffer:");
      return this.dispatch(new Uint8Array(arr));
    }
    url(url: any) {
      return this.write("url:" + url.toString());
    }
    map(map: any) {
      this.write("map:");
      const arr = [...map];
      return this.array(arr, false);
    }
    set(set: any) {
      this.write("set:");
      const arr = [...set];
      return this.array(arr, false);
    }
    bigint(number: number) {
      return this.write("bigint:" + number.toString());
    }
  }

  for (const type of [
    "uint8array",
    "uint8clampedarray",
    "unt8array",
    "uint16array",
    "unt16array",
    "uint32array",
    "unt32array",
    "float32array",
    "float64array",
  ]) {
    // @ts-ignore
    Hasher.prototype[type] = function (arr: any) {
      this.write(type + ":");
      return this.array([...arr], false);
    };
  }

  /** Check if the given function is a native function */
  function isNativeFunction(f: any) {
    if (typeof f !== "function") {
      return false;
    }
    return (
      Function.prototype.toString
        .call(f)
        .slice(-15 /* "[native code] }".length */) === "[native code] }"
    );
  }

  return Hasher;
})();

export function serialize(object: any): string {
  const hasher = new Hasher();
  hasher.dispatch(object);
  return hasher.buff;
}

export function hash(value: any) {
  return digest(typeof value === "string" ? value : serialize(value))
    .replace(/[-_]/g, "")
    .slice(0, 10);
}
