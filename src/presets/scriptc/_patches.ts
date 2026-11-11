// Source patches for code that scriptc can't compile natively yet (https://github.com/h3js/srvx/issues/362).
// Each one keeps the same behavior on Node.js.

export interface SourcePatch {
  /** Module id filter. */
  id: RegExp;
  /** Code to replace (all occurrences for strings). */
  from: string | RegExp;
  to: string | ((match: string, ...groups: string[]) => string);
  /** Warn when the patch does not apply (default: `true`). */
  required?: boolean;
}

const nitroRuntime = (path: string) =>
  new RegExp(String.raw`/(src|dist)/runtime/${path}\.(ts|mjs)$`);

const h3Dist = (file: string) => new RegExp(String.raw`/h3/dist/${file}\.mjs$`);

const ocacheDist = /\/ocache\/dist\/index\.mjs$/;

const h3Methods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
  "CONNECT",
  "TRACE",
  "QUERY",
];

export const patches: SourcePatch[] = [
  // --- Nitro ---

  // Lazy handlers can't be passed into untyped code: import them eagerly
  {
    id: /#nitro\/virtual\/routing$/,
    from: /const (\w+) = h3\.defineLazyEventHandler\(\(\) => import\(("[^"]+")\)\);/g,
    to: "import $1_default from $2;\nconst $1 = h3.toEventHandler($1_default);",
    required: false,
  },
  // `Request` can't take extra properties
  {
    id: /#nitro\/virtual\/app$/,
    from: "req.context ||= {};\n    req.context.nitro = req.context.nitro || { errors: [] };",
    to: "try {\n      req.context ||= {};\n      req.context.nitro = req.context.nitro || { errors: [] };\n    } catch {}",
  },
  {
    id: nitroRuntime("(internal/app|nitro)"),
    from: /(\w+)\.context = (\{\s*\.\.\.\1\.context,\s*\.\.\.context\s*\})( as ServerRequestContext)?;/g,
    to: "try {\n    $1.context = $2$3;\n  } catch {}",
    required: false,
  },
  // Short-circuit assignment to a function property (memoized singletons)
  {
    id: nitroRuntime("internal/(kv|runtime-config)"),
    from: /(?:\((\w+) as any\)|\b(\w+))\.(_\w+) (\?\?|\|\|)= (\w+\(\))/g,
    to: (_, tsName, jsName, prop, op, init) => {
      const target = `${tsName || jsName}.${prop}`;
      return `${target} ${op} (${target} = ${init})`;
    },
  },

  // --- h3 ---

  {
    id: h3Dist("response"),
    from: "this.context = req.context = context || req.context || new EmptyObject();",
    to: "this.context = context || req.context || new EmptyObject();\n\t\ttry { req.context = this.context; } catch {}",
  },
  // `this[key] ||= value`
  {
    id: h3Dist("response"),
    from: /return this\[(\w+)\] \|\|= (.+);/g,
    to: "return this[$1] || (this[$1] = $2);",
  },
  // Prototype writes (the brand is only needed across realms)
  {
    id: h3Dist("response"),
    from: "HTTPResponse.prototype[kHTTPResponse] = true;",
    to: "",
  },
  // Built-in classes can't be extended
  {
    id: h3Dist("response"),
    from: /\/\* @__PURE__ \*\/ new FrozenHeaders\(/g,
    to: "new Headers(",
  },
  // Error subclasses can't be logged as is
  {
    id: h3Dist("response"),
    from: /console\.error\(((?:"[^"]*", )?)(error|hookError)\)/g,
    to: "console.error($1String($2?.stack || $2))",
  },
  // Types are inferred from JS when bundled
  {
    id: h3Dist("response"),
    from: "static isError(input) {",
    to: "/** @param {unknown} input @returns {input is HTTPError} */\n\tstatic isError(input) {",
  },
  {
    id: h3Dist("cache"),
    from: `"~findRoute"(_event) {}`,
    to: `/** @param {unknown} _event @returns {any} */\n\t"~findRoute"(_event) {}`,
  },
  // Chained assignment (compiler crash)
  {
    id: h3Dist("cache"),
    from: `this["~dispatch"] = this["~composed"] = void 0;`,
    to: `this["~dispatch"] = void 0;\n\t\t\t\t\tthis["~composed"] = void 0;`,
  },
  // `super[key]()`
  {
    id: h3Dist("cache"),
    from: `super["~addRoute"](_route);`,
    to: `this["~routes"].push(_route);`,
  },
  // Methods installed on the prototype: define them in the class instead
  {
    id: h3Dist("cache"),
    from: /\tfor \(const method of \[[^\]]*\]\) H3Core\.prototype\[method\.toLowerCase\(\)\] = function\(route, handler, opts\) \{\n\t\treturn this\.on\(method, route, handler, opts\);\n\t\};\n/,
    to: "",
  },
  {
    id: h3Dist("cache"),
    from: `\t\tall(route, handler, opts) {`,
    to:
      h3Methods
        .map(
          (m) =>
            `\t\t${m.toLowerCase()}(route, handler, opts) {\n\t\t\treturn this.on("${m}", route, handler, opts);\n\t\t}\n`
        )
        .join("") + `\t\tall(route, handler, opts) {`,
  },

  // --- unstorage ---

  // `Object.prototype.isPrototypeOf`
  {
    id: /\/unstorage\/dist\/_chunks\/_utils\.mjs$/,
    from: "return !proto || proto.isPrototypeOf(Object);",
    to: "return !proto || proto === Object.prototype || proto === Function.prototype;",
  },

  // --- ocache ---

  // `Function.prototype.toString` (used to name and hash anonymous functions)
  {
    id: ocacheDist,
    from: "return name || fn.name || `anon_${hash(fn).slice(0, 16)}`;",
    to: "return name || fn.name || `anon_${++anonCount}`;\n}\nlet anonCount = 0;\n{",
  },
  {
    id: ocacheDist,
    from: "Function.prototype.toString.call(value)",
    to: '(() => {\n\t\t\ttry {\n\t\t\t\treturn Function.prototype.toString.call(value);\n\t\t\t} catch {\n\t\t\t\treturn "";\n\t\t\t}\n\t\t})()',
  },
  // No `SharedArrayBuffer`
  {
    id: ocacheDist,
    from: /const (SharedBuffer(?:\$1)?) = globalThis\.SharedArrayBuffer;/g,
    to: "const $1 = void 0;",
  },
  {
    id: ocacheDist,
    from: /SharedBuffer(\$1)? (?:!== void 0 )?&& value instanceof SharedBuffer\1/g,
    to: "false",
  },
];
