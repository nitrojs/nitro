import { HTTPError, defineHandler, getRequestIP } from "h3";
import type { Nitro } from "nitro/types";

export function createVFSHandler(nitro: Nitro) {
  return defineHandler(async (event) => {
    const { socket } = event.runtime?.node?.req || {};

    // prettier-ignore
    const isUnixSocket =
      // No network addresses
      (!socket?.remoteAddress && !socket?.localAddress) &&
      // Empty address object
      Object.keys(socket?.address?.() || {}).length === 0 &&
      // Socket is readable/writable but has no port info
      socket?.readable && socket?.writable && !socket?.remotePort;

    const ip = getRequestIP(event, { xForwardedFor: isUnixSocket });

    const isLocalRequest = ip && /^::1$|^127\.\d+\.\d+\.\d+$/.test(ip);
    if (!isLocalRequest) {
      throw new HTTPError({
        statusText: `Forbidden IP: "${ip || "?"}"`,
        status: 403,
      });
    }

    const url = event.context.params?._ || "";
    const isJson =
      url.endsWith(".json") || event.req.headers.get("accept")?.includes("application/json");
    const id = decodeURIComponent(url.replace(/^(\.json)?\/?/, "") || "");

    if (id && !nitro.vfs.has(id)) {
      throw new HTTPError({ message: "File not found", status: 404 });
    }

    const content = id ? await nitro.vfs.get(id)?.render() : undefined;

    if (isJson) {
      return {
        rootDir: nitro.options.rootDir,
        entries: [...nitro.vfs.keys()].map((id) => ({
          id,
          path: "/_vfs.json/" + encodeURIComponent(id),
        })),
        current: id
          ? {
              id,
              content,
            }
          : null,
      };
    }

    const directories: Record<string, any> = { [nitro.options.rootDir]: {} };
    const fpaths = [...nitro.vfs.keys()];

    for (const item of fpaths) {
      const segments = item.replace(nitro.options.rootDir, "").split("/").filter(Boolean);
      let currentDir = item.startsWith(nitro.options.rootDir)
        ? directories[nitro.options.rootDir]
        : directories;

      for (const segment of segments) {
        if (!currentDir[segment]) {
          currentDir[segment] = {};
        }

        currentDir = currentDir[segment];
      }
    }

    const generateHTML = (directory: Record<string, any>, path: string[] = []): string =>
      Object.entries(directory)
        .map(([fname, value = {}]) => {
          const subpath = [...path, fname];
          const key = subpath.join("/");
          const encodedUrl = encodeURIComponent(key);

          const linkClass =
            url === `/${encodedUrl}` ? "bg-gray-700 text-white" : "hover:bg-gray-800 text-gray-200";

          return Object.keys(value).length === 0
            ? `
            <li class="flex flex-nowrap">
              <a href="/_vfs/${encodedUrl}" class="w-full text-sm px-2 py-1 border-b border-gray-10 ${linkClass}">
                ${fname}
              </a>
            </li>
            `
            : `
            <li>
              <details ${url.startsWith(`/${encodedUrl}`) ? "open" : ""}>
                <summary class="w-full text-sm px-2 py-1 border-b border-gray-10 hover:bg-gray-800 text-gray-200">
                  ${fname}
                </summary>
                <ul class="ml-4">
                  ${generateHTML(value, subpath)}
                </ul>
              </details>
            </li>
            `;
        })
        .join("");

    const rootDirectory = directories[nitro.options.rootDir];
    delete directories[nitro.options.rootDir];
    const items = generateHTML(rootDirectory, [nitro.options.rootDir]) + generateHTML(directories);

    const files = `
      <div class="h-full overflow-auto border-r border-gray:10">
        <p class="text-white text-bold text-center py-1 opacity-50">Virtual Files</p>
        <ul class="flex flex-col">${items}</ul>
      </div>
      `;

    const file = id
      ? editorTemplate({
          readOnly: true,
          language: id.endsWith("html") ? "html" : "javascript",
          theme: "vs-dark",
          value: content,
          wordWrap: "wordWrapColumn",
          wordWrapColumn: 80,
        })
      : `
        <div class="w-full h-full flex opacity-50">
          <h1 class="text-white m-auto">Select a virtual file to inspect</h1>
        </div>
      `;

    event.res.headers.set("Content-Type", "text/html; charset=utf-8");
    return /* html */ `
<!doctype html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@unocss/reset/tailwind.min.css" />
  <link rel="stylesheet" data-name="vs/editor/editor.main" href="${vsUrl}/editor/editor.main.min.css">
  <script src="https://cdn.jsdelivr.net/npm/@unocss/runtime"></script>
  <style>
    html {
      background: #1E1E1E;
      color: white;
    }
    [un-cloak] {
      display: none;
    }
  </style>
</head>
<body class="bg-[#1E1E1E]">
  <div un-cloak class="h-screen grid grid-cols-[300px_1fr]">
    ${files}
    ${file}
  </div>
</body>
</html>`;
  });
}

const monacoVersion = "0.30.0";
const monacoUrl = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${monacoVersion}/min`;
const vsUrl = `${monacoUrl}/vs`;

const editorTemplate = (options: Record<string, any>) => `
<div id="editor" class="min-h-screen w-full h-full"></div>
<script src="${vsUrl}/loader.min.js"></script>
<script>
  require.config({ paths: { vs: '${vsUrl}' } })

  const proxy = URL.createObjectURL(new Blob([\`
    self.MonacoEnvironment = { baseUrl: '${monacoUrl}' }
    importScripts('${vsUrl}/base/worker/workerMain.min.js')
  \`], { type: 'text/javascript' }))
  window.MonacoEnvironment = { getWorkerUrl: () => proxy }

  setTimeout(() => {
    require(['vs/editor/editor.main'], function () {
      monaco.editor.create(document.getElementById('editor'), ${JSON.stringify(options)})
    })
  }, 0);
</script>
`;
