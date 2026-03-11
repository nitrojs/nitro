---
category: features
icon: i-lucide-radio
---

# WebSocket

> Real-time bidirectional communication with WebSocket support.

<!-- automd:ui-code-tree src="../../examples/websocket" default="routes/_ws.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="routes/_ws.ts" expandAll}

```html [index.html]
<html lang="en" data-theme="dark">
  <head>
    <title>CrossWS Test Page</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body {
        background-color: #1a1a1a;
      }
    </style>
    <script type="module">
      import { createApp, reactive, nextTick } from "https://esm.sh/petite-vue@0.4.1";

      let ws;

      const store = reactive({
        message: "",
        messages: [],
      });

      const scroll = () => {
        nextTick(() => {
          const el = document.querySelector("#messages");
          el.scrollTop = el.scrollHeight;
          el.scrollTo({
            top: el.scrollHeight,
            behavior: "smooth",
          });
        });
      };

      const format = async () => {
        for (const message of store.messages) {
          if (!message._fmt && message.text.startsWith("{")) {
            message._fmt = true;
            const { codeToHtml } = await import("https://esm.sh/shiki@1.0.0");
            const str = JSON.stringify(JSON.parse(message.text), null, 2);
            message.formattedText = await codeToHtml(str, {
              lang: "json",
              theme: "dark-plus",
            });
          }
        }
      };

      const log = (user, ...args) => {
        console.log("[ws]", user, ...args);
        store.messages.push({
          text: args.join(" "),
          formattedText: "",
          user: user,
          date: new Date().toLocaleString(),
        });
        scroll();
        format();
      };

      const connect = async () => {
        const isSecure = location.protocol === "https:";
        const url = (isSecure ? "wss://" : "ws://") + location.host + "/_ws";
        if (ws) {
          log("ws", "Closing previous connection before reconnecting...");
          ws.close();
          clear();
        }

        log("ws", "Connecting to", url, "...");
        ws = new WebSocket(url);

        ws.addEventListener("message", async (event) => {
          let data = typeof event.data === "string" ? event.data : await event.data.text();
          const { user = "system", message = "" } = data.startsWith("{")
            ? JSON.parse(data)
            : { message: data };
          log(user, typeof message === "string" ? message : JSON.stringify(message));
        });

        await new Promise((resolve) => ws.addEventListener("open", resolve));
        log("ws", "Connected!");
      };

      const clear = () => {
        store.messages.splice(0, store.messages.length);
        log("system", "previous messages cleared");
      };

      const send = () => {
        console.log("sending message...");
        if (store.message) {
          ws.send(store.message);
        }
        store.message = "";
      };

      const ping = () => {
        log("ws", "Sending ping");
        ws.send("ping");
      };

      createApp({
        store,
        send,
        ping,
        clear,
        connect,
        rand: Math.random(),
      }).mount();

      await connect();
    </script>
  </head>
  <body class="h-screen flex flex-col justify-between">
    <main v-scope="{}">
      <!-- Messages -->
      <div id="messages" class="flex-grow flex flex-col justify-end px-4 py-8">
        <div class="flex items-center mb-4" v-for="message in store.messages">
          <div class="flex flex-col">
            <p class="text-gray-500 mb-1 text-xs ml-10">{{ message.user }}</p>
            <div class="flex items-center">
              <img
                :src="'https://www.gravatar.com/avatar/' + encodeURIComponent(message.user + rand) + '?s=512&d=monsterid'"
                alt="Avatar"
                class="w-8 h-8 rounded-full"
              />
              <div class="ml-2 bg-gray-800 rounded-lg p-2">
                <p
                  v-if="message.formattedText"
                  class="overflow-x-scroll"
                  v-html="message.formattedText"
                ></p>
                <p v-else class="text-white">{{ message.text }}</p>
              </div>
            </div>
            <p class="text-gray-500 mt-1 text-xs ml-10">{{ message.date }}</p>
          </div>
        </div>
      </div>

      <!-- Chatbox -->
      <div class="bg-gray-800 px-4 py-2 flex items-center justify-between fixed bottom-0 w-full">
        <div class="w-full min-w-6">
          <input
            type="text"
            placeholder="Type your message..."
            class="w-full rounded-l-lg px-4 py-2 bg-gray-700 text-white focus:outline-none focus:ring focus:border-blue-300"
            @keydown.enter="send"
            v-model="store.message"
          />
        </div>
        <div class="flex">
          <button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4" @click="send">
            Send
          </button>
          <button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4" @click="ping">
            Ping
          </button>
          <button class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4" @click="connect">
            Reconnect
          </button>
          <button
            class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-r-lg"
            @click="clear"
          >
            Clear
          </button>
        </div>
      </div>
    </main>
  </body>
</html>
`
```

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
  renderer: { static: true },
  features: { websocket: true },
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build"
  },
  "devDependencies": {
    "nitro": "latest"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

```ts [routes/_ws.ts]
import { defineWebSocketHandler } from "nitro/h3";

export default defineWebSocketHandler({
  open(peer) {
    peer.send({ user: "server", message: `Welcome ${peer}!` });
    peer.publish("chat", { user: "server", message: `${peer} joined!` });
    peer.subscribe("chat");
  },
  message(peer, message) {
    if (message.text().includes("ping")) {
      peer.send({ user: "server", message: "pong" });
    } else {
      const msg = {
        user: peer.toString(),
        message: message.toString(),
      };
      peer.send(msg); // echo
      peer.publish("chat", msg);
    }
  },
  close(peer) {
    peer.publish("chat", { user: "server", message: `${peer} left!` });
  },
});
```

```json [.vercel/output/config.json]
{
  "version": 3,
  "framework": {
    "name": "nitro",
    "version": "3.0.1-alpha.2"
  },
  "overrides": {},
  "routes": [
    {
      "handle": "filesystem"
    },
    {
      "src": "/_ws",
      "dest": "/_ws"
    },
    {
      "src": "/(.*)",
      "dest": "/__server"
    }
  ]
}
```

```json [.vercel/output/nitro.json]
{
  "date": "2026-02-18T22:28:34.457Z",
  "preset": "vercel",
  "framework": {
    "name": "nitro",
    "version": "3.0.1-alpha.2"
  },
  "versions": {
    "nitro": "3.0.1-alpha.2"
  },
  "serverEntry": "functions/__server.func/index.mjs",
  "publicDir": "static",
  "commands": {
    "preview": "npx srvx --static ../../static ./functions/__server.func/index.mjs",
    "deploy": "npx vercel deploy --prebuilt"
  },
  "config": {
    "vercel": {
      "skewProtection": false,
      "cronHandlerRoute": "/_vercel/cron",
      "functions": {
        "runtime": "nodejs24.x"
      }
    }
  }
}
```

```json [.wrangler/deploy/config.json]
{"configPath":"../../.output/server/wrangler.json"}
```

```js [.vercel/output/functions/__server.func/_ws.mjs]
import { i as defineWebSocketHandler } from "./_libs/h3+rou3+srvx.mjs";
var _ws_default = defineWebSocketHandler({
	open(peer) {
		peer.send({
			user: "server",
			message: `Welcome ${peer}!`
		});
		peer.publish("chat", {
			user: "server",
			message: `${peer} joined!`
		});
		peer.subscribe("chat");
	},
	message(peer, message) {
		if (message.text().includes("ping")) peer.send({
			user: "server",
			message: "pong"
		});
		else {
			const msg = {
				user: peer.toString(),
				message: message.toString()
			};
			peer.send(msg);
			peer.publish("chat", msg);
		}
	},
	close(peer) {
		peer.publish("chat", {
			user: "server",
			message: `${peer} left!`
		});
	}
});
export { _ws_default as default };
```

```json [.vercel/output/functions/__server.func/.vc-config.json]
{
  "handler": "index.mjs",
  "launcherType": "Nodejs",
  "shouldAddHelpers": false,
  "supportsResponseStreaming": true,
  "runtime": "nodejs24.x"
}
```

```js [.vercel/output/functions/__server.func/index.mjs]
globalThis.__nitro_main__ = import.meta.url;
import { a as NodeResponse, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import "./_libs/hookable.mjs";
const errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event, opts) {
	const isSensitive = error.unhandled;
	const status = error.status || 500;
	const url = event.url || new URL(event.req.url);
	if (status === 404) {
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			statusText: "Found",
			headers: { location: `${baseURL}${url.pathname.slice(1)}${url.search}` },
			body: `Redirecting...`
		};
	}
	if (isSensitive && !opts?.silent) {
		const tags = [error.unhandled && "[unhandled]"].filter(Boolean).join(" ");
		console.error(`[request error] ${tags} [${event.req.method}] ${url}\n`, error);
	}
	const headers = {
		"content-type": "application/json",
		"x-content-type-options": "nosniff",
		"x-frame-options": "DENY",
		"referrer-policy": "no-referrer",
		"content-security-policy": "script-src 'none'; frame-ancestors 'none';"
	};
	if (status === 404 || !event.res.headers.has("cache-control")) headers["cache-control"] = "no-cache";
	const body = {
		error: true,
		url: url.href,
		status,
		statusText: error.statusText,
		message: isSensitive ? "Server Error" : error.message,
		data: isSensitive ? void 0 : error.data
	};
	return {
		status,
		statusText: error.statusText,
		headers,
		body
	};
}
const errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
const findRouteRules = (m, p) => {
	return [];
};
const _lazy_5cgWFb = defineLazyEventHandler(() => import("./_ws.mjs"));
const _lazy_etkEWp = defineLazyEventHandler(() => import("./_chunks/renderer-template.mjs"));
const findRoute = /* @__PURE__ */ (() => {
	const $0 = {
		route: "/_ws",
		handler: _lazy_5cgWFb
	}, $1 = {
		route: "/**",
		handler: _lazy_etkEWp
	};
	return (m, p) => {
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		if (p === "/_ws") return { data: $0 };
		let s = p.split("/");
		s.length - 1;
		return {
			data: $1,
			params: { "_": s.slice(1).join("/") }
		};
	};
})();
[].filter(Boolean);
const APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function createNitroApp() {
	const hooks = void 0;
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	return h3App;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	for (const rule of Object.values(routeRules)) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
function isrRouteRewrite(reqUrl, xNowRouteMatches) {
	if (xNowRouteMatches) {
		const isrURL = new URLSearchParams(xNowRouteMatches).get("__isr_route");
		if (isrURL) return [decodeURIComponent(isrURL), ""];
	} else {
		const queryIndex = reqUrl.indexOf("?");
		if (queryIndex !== -1) {
			const params = new URLSearchParams(reqUrl.slice(queryIndex + 1));
			const isrURL = params.get("__isr_route");
			if (isrURL) {
				params.delete("__isr_route");
				return [decodeURIComponent(isrURL), params.toString()];
			}
		}
	}
}
const nitroApp = useNitroApp();
var vercel_web_default = { fetch(req, context) {
	const isrURL = isrRouteRewrite(req.url, req.headers.get("x-now-route-matches"));
	if (isrURL) {
		const { routeRules } = getRouteRules("", isrURL[0]);
		if (routeRules?.isr) req = new Request(new URL(isrURL[0] + (isrURL[1] ? `?${isrURL[1]}` : ""), req.url).href, req);
	}
	req.runtime ??= { name: "vercel" };
	req.runtime.vercel = { context };
	let ip;
	Object.defineProperty(req, "ip", { get() {
		const h = req.headers.get("x-forwarded-for");
		return ip ??= h?.split(",").shift()?.trim();
	} });
	req.waitUntil = context?.waitUntil;
	return nitroApp.fetch(req);
} };
export { vercel_web_default as default };
```

```js [.vercel/output/functions/_ws.func/_ws.mjs]
import { i as defineWebSocketHandler } from "./_libs/h3+rou3+srvx.mjs";
var _ws_default = defineWebSocketHandler({
	open(peer) {
		peer.send({
			user: "server",
			message: `Welcome ${peer}!`
		});
		peer.publish("chat", {
			user: "server",
			message: `${peer} joined!`
		});
		peer.subscribe("chat");
	},
	message(peer, message) {
		if (message.text().includes("ping")) peer.send({
			user: "server",
			message: "pong"
		});
		else {
			const msg = {
				user: peer.toString(),
				message: message.toString()
			};
			peer.send(msg);
			peer.publish("chat", msg);
		}
	},
	close(peer) {
		peer.publish("chat", {
			user: "server",
			message: `${peer} left!`
		});
	}
});
export { _ws_default as default };
```

```json [.vercel/output/functions/_ws.func/.vc-config.json]
{
  "handler": "index.mjs",
  "launcherType": "Nodejs",
  "shouldAddHelpers": false,
  "supportsResponseStreaming": true,
  "runtime": "nodejs24.x"
}
```

```js [.vercel/output/functions/_ws.func/index.mjs]
globalThis.__nitro_main__ = import.meta.url;
import { a as NodeResponse, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import "./_libs/hookable.mjs";
const errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event, opts) {
	const isSensitive = error.unhandled;
	const status = error.status || 500;
	const url = event.url || new URL(event.req.url);
	if (status === 404) {
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			statusText: "Found",
			headers: { location: `${baseURL}${url.pathname.slice(1)}${url.search}` },
			body: `Redirecting...`
		};
	}
	if (isSensitive && !opts?.silent) {
		const tags = [error.unhandled && "[unhandled]"].filter(Boolean).join(" ");
		console.error(`[request error] ${tags} [${event.req.method}] ${url}\n`, error);
	}
	const headers = {
		"content-type": "application/json",
		"x-content-type-options": "nosniff",
		"x-frame-options": "DENY",
		"referrer-policy": "no-referrer",
		"content-security-policy": "script-src 'none'; frame-ancestors 'none';"
	};
	if (status === 404 || !event.res.headers.has("cache-control")) headers["cache-control"] = "no-cache";
	const body = {
		error: true,
		url: url.href,
		status,
		statusText: error.statusText,
		message: isSensitive ? "Server Error" : error.message,
		data: isSensitive ? void 0 : error.data
	};
	return {
		status,
		statusText: error.statusText,
		headers,
		body
	};
}
const errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
const findRouteRules = (m, p) => {
	return [];
};
const _lazy_5cgWFb = defineLazyEventHandler(() => import("./_ws.mjs"));
const _lazy_etkEWp = defineLazyEventHandler(() => import("./_chunks/renderer-template.mjs"));
const findRoute = /* @__PURE__ */ (() => {
	const $0 = {
		route: "/_ws",
		handler: _lazy_5cgWFb
	}, $1 = {
		route: "/**",
		handler: _lazy_etkEWp
	};
	return (m, p) => {
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		if (p === "/_ws") return { data: $0 };
		let s = p.split("/");
		s.length - 1;
		return {
			data: $1,
			params: { "_": s.slice(1).join("/") }
		};
	};
})();
[].filter(Boolean);
const APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function createNitroApp() {
	const hooks = void 0;
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	return h3App;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	for (const rule of Object.values(routeRules)) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
function isrRouteRewrite(reqUrl, xNowRouteMatches) {
	if (xNowRouteMatches) {
		const isrURL = new URLSearchParams(xNowRouteMatches).get("__isr_route");
		if (isrURL) return [decodeURIComponent(isrURL), ""];
	} else {
		const queryIndex = reqUrl.indexOf("?");
		if (queryIndex !== -1) {
			const params = new URLSearchParams(reqUrl.slice(queryIndex + 1));
			const isrURL = params.get("__isr_route");
			if (isrURL) {
				params.delete("__isr_route");
				return [decodeURIComponent(isrURL), params.toString()];
			}
		}
	}
}
const nitroApp = useNitroApp();
var vercel_web_default = { fetch(req, context) {
	const isrURL = isrRouteRewrite(req.url, req.headers.get("x-now-route-matches"));
	if (isrURL) {
		const { routeRules } = getRouteRules("", isrURL[0]);
		if (routeRules?.isr) req = new Request(new URL(isrURL[0] + (isrURL[1] ? `?${isrURL[1]}` : ""), req.url).href, req);
	}
	req.runtime ??= { name: "vercel" };
	req.runtime.vercel = { context };
	let ip;
	Object.defineProperty(req, "ip", { get() {
		const h = req.headers.get("x-forwarded-for");
		return ip ??= h?.split(",").shift()?.trim();
	} });
	req.waitUntil = context?.waitUntil;
	return nitroApp.fetch(req);
} };
export { vercel_web_default as default };
```

```js [.vercel/output/functions/__server.func/_chunks/renderer-template.mjs]
import { n as HTTPResponse } from "../_libs/h3+rou3+srvx.mjs";
const rendererTemplate = () => new HTTPResponse("<html lang=\"en\" data-theme=\"dark\">\n  <head>\n    <title>CrossWS Test Page</title>\n    <script src=\"https://cdn.tailwindcss.com\"><\/script>\n    <style>\n      body {\n        background-color: #1a1a1a;\n      }\n    </style>\n    <script type=\"module\">\n      import { createApp, reactive, nextTick } from \"https://esm.sh/petite-vue@0.4.1\";\n\n      let ws;\n\n      const store = reactive({\n        message: \"\",\n        messages: [],\n      });\n\n      const scroll = () => {\n        nextTick(() => {\n          const el = document.querySelector(\"#messages\");\n          el.scrollTop = el.scrollHeight;\n          el.scrollTo({\n            top: el.scrollHeight,\n            behavior: \"smooth\",\n          });\n        });\n      };\n\n      const format = async () => {\n        for (const message of store.messages) {\n          if (!message._fmt && message.text.startsWith(\"{\")) {\n            message._fmt = true;\n            const { codeToHtml } = await import(\"https://esm.sh/shiki@1.0.0\");\n            const str = JSON.stringify(JSON.parse(message.text), null, 2);\n            message.formattedText = await codeToHtml(str, {\n              lang: \"json\",\n              theme: \"dark-plus\",\n            });\n          }\n        }\n      };\n\n      const log = (user, ...args) => {\n        console.log(\"[ws]\", user, ...args);\n        store.messages.push({\n          text: args.join(\" \"),\n          formattedText: \"\",\n          user: user,\n          date: new Date().toLocaleString(),\n        });\n        scroll();\n        format();\n      };\n\n      const connect = async () => {\n        const isSecure = location.protocol === \"https:\";\n        const url = (isSecure ? \"wss://\" : \"ws://\") + location.host + \"/_ws\";\n        if (ws) {\n          log(\"ws\", \"Closing previous connection before reconnecting...\");\n          ws.close();\n          clear();\n        }\n\n        log(\"ws\", \"Connecting to\", url, \"...\");\n        ws = new WebSocket(url);\n\n        ws.addEventListener(\"message\", async (event) => {\n          let data = typeof event.data === \"string\" ? event.data : await event.data.text();\n          const { user = \"system\", message = \"\" } = data.startsWith(\"{\")\n            ? JSON.parse(data)\n            : { message: data };\n          log(user, typeof message === \"string\" ? message : JSON.stringify(message));\n        });\n\n        await new Promise((resolve) => ws.addEventListener(\"open\", resolve));\n        log(\"ws\", \"Connected!\");\n      };\n\n      const clear = () => {\n        store.messages.splice(0, store.messages.length);\n        log(\"system\", \"previous messages cleared\");\n      };\n\n      const send = () => {\n        console.log(\"sending message...\");\n        if (store.message) {\n          ws.send(store.message);\n        }\n        store.message = \"\";\n      };\n\n      const ping = () => {\n        log(\"ws\", \"Sending ping\");\n        ws.send(\"ping\");\n      };\n\n      createApp({\n        store,\n        send,\n        ping,\n        clear,\n        connect,\n        rand: Math.random(),\n      }).mount();\n\n      await connect();\n    <\/script>\n  </head>\n  <body class=\"h-screen flex flex-col justify-between\">\n    <main v-scope=\"{}\">\n      <!-- Messages -->\n      <div id=\"messages\" class=\"flex-grow flex flex-col justify-end px-4 py-8\">\n        <div class=\"flex items-center mb-4\" v-for=\"message in store.messages\">\n          <div class=\"flex flex-col\">\n            <p class=\"text-gray-500 mb-1 text-xs ml-10\">{{ message.user }}</p>\n            <div class=\"flex items-center\">\n              <img\n                :src=\"'https://www.gravatar.com/avatar/' + encodeURIComponent(message.user + rand) + '?s=512&d=monsterid'\"\n                alt=\"Avatar\"\n                class=\"w-8 h-8 rounded-full\"\n              />\n              <div class=\"ml-2 bg-gray-800 rounded-lg p-2\">\n                <p\n                  v-if=\"message.formattedText\"\n                  class=\"overflow-x-scroll\"\n                  v-html=\"message.formattedText\"\n                ></p>\n                <p v-else class=\"text-white\">{{ message.text }}</p>\n              </div>\n            </div>\n            <p class=\"text-gray-500 mt-1 text-xs ml-10\">{{ message.date }}</p>\n          </div>\n        </div>\n      </div>\n\n      <!-- Chatbox -->\n      <div class=\"bg-gray-800 px-4 py-2 flex items-center justify-between fixed bottom-0 w-full\">\n        <div class=\"w-full min-w-6\">\n          <input\n            type=\"text\"\n            placeholder=\"Type your message...\"\n            class=\"w-full rounded-l-lg px-4 py-2 bg-gray-700 text-white focus:outline-none focus:ring focus:border-blue-300\"\n            @keydown.enter=\"send\"\n            v-model=\"store.message\"\n          />\n        </div>\n        <div class=\"flex\">\n          <button class=\"bg-blue-500 hover:bg-blue-600 text-white py-2 px-4\" @click=\"send\">\n            Send\n          </button>\n          <button class=\"bg-blue-500 hover:bg-blue-600 text-white py-2 px-4\" @click=\"ping\">\n            Ping\n          </button>\n          <button class=\"bg-blue-500 hover:bg-blue-600 text-white py-2 px-4\" @click=\"connect\">\n            Reconnect\n          </button>\n          <button\n            class=\"bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-r-lg\"\n            @click=\"clear\"\n          >\n            Clear\n          </button>\n        </div>\n      </div>\n    </main>\n  </body>\n</html>\n`\n", { headers: { "content-type": "text/html; charset=utf-8" } });
function renderIndexHTML(event) {
	return rendererTemplate(event.req);
}
export { renderIndexHTML as default };
```

```js [.vercel/output/functions/__server.func/_libs/h3+rou3+srvx.mjs]
import { PassThrough, Readable } from "node:stream";
const NullProtoObj = /* @__PURE__ */ (() => {
	const e = function() {};
	return e.prototype = Object.create(null), Object.freeze(e.prototype), e;
})();
function lazyInherit(target, source, sourceKey) {
	for (const key of [...Object.getOwnPropertyNames(source), ...Object.getOwnPropertySymbols(source)]) {
		if (key === "constructor") continue;
		const targetDesc = Object.getOwnPropertyDescriptor(target, key);
		const desc = Object.getOwnPropertyDescriptor(source, key);
		let modified = false;
		if (desc.get) {
			modified = true;
			desc.get = targetDesc?.get || function() {
				return this[sourceKey][key];
			};
		}
		if (desc.set) {
			modified = true;
			desc.set = targetDesc?.set || function(value) {
				this[sourceKey][key] = value;
			};
		}
		if (!targetDesc?.value && typeof desc.value === "function") {
			modified = true;
			desc.value = function(...args) {
				return this[sourceKey][key](...args);
			};
		}
		if (modified) Object.defineProperty(target, key, desc);
	}
}
const FastURL = /* @__PURE__ */ (() => {
	const NativeURL = globalThis.URL;
	const FastURL = class URL {
		#url;
		#href;
		#protocol;
		#host;
		#pathname;
		#search;
		#searchParams;
		#pos;
		constructor(url) {
			if (typeof url === "string") this.#href = url;
			else {
				this.#protocol = url.protocol;
				this.#host = url.host;
				this.#pathname = url.pathname;
				this.#search = url.search;
			}
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeURL;
		}
		get _url() {
			if (this.#url) return this.#url;
			this.#url = new NativeURL(this.href);
			this.#href = void 0;
			this.#protocol = void 0;
			this.#host = void 0;
			this.#pathname = void 0;
			this.#search = void 0;
			this.#searchParams = void 0;
			this.#pos = void 0;
			return this.#url;
		}
		get href() {
			if (this.#url) return this.#url.href;
			if (!this.#href) this.#href = `${this.#protocol || "http:"}//${this.#host || "localhost"}${this.#pathname || "/"}${this.#search || ""}`;
			return this.#href;
		}
		#getPos() {
			if (!this.#pos) {
				const url = this.href;
				const protoIndex = url.indexOf("://");
				const pathnameIndex = protoIndex === -1 ? -1 : url.indexOf("/", protoIndex + 4);
				this.#pos = [
					protoIndex,
					pathnameIndex,
					pathnameIndex === -1 ? -1 : url.indexOf("?", pathnameIndex)
				];
			}
			return this.#pos;
		}
		get pathname() {
			if (this.#url) return this.#url.pathname;
			if (this.#pathname === void 0) {
				const [, pathnameIndex, queryIndex] = this.#getPos();
				if (pathnameIndex === -1) return this._url.pathname;
				this.#pathname = this.href.slice(pathnameIndex, queryIndex === -1 ? void 0 : queryIndex);
			}
			return this.#pathname;
		}
		get search() {
			if (this.#url) return this.#url.search;
			if (this.#search === void 0) {
				const [, pathnameIndex, queryIndex] = this.#getPos();
				if (pathnameIndex === -1) return this._url.search;
				const url = this.href;
				this.#search = queryIndex === -1 || queryIndex === url.length - 1 ? "" : url.slice(queryIndex);
			}
			return this.#search;
		}
		get searchParams() {
			if (this.#url) return this.#url.searchParams;
			if (!this.#searchParams) this.#searchParams = new URLSearchParams(this.search);
			return this.#searchParams;
		}
		get protocol() {
			if (this.#url) return this.#url.protocol;
			if (this.#protocol === void 0) {
				const [protocolIndex] = this.#getPos();
				if (protocolIndex === -1) return this._url.protocol;
				this.#protocol = this.href.slice(0, protocolIndex + 1);
			}
			return this.#protocol;
		}
		toString() {
			return this.href;
		}
		toJSON() {
			return this.href;
		}
	};
	lazyInherit(FastURL.prototype, NativeURL.prototype, "_url");
	Object.setPrototypeOf(FastURL.prototype, NativeURL.prototype);
	Object.setPrototypeOf(FastURL, NativeURL);
	return FastURL;
})();
const NodeResponse = /* @__PURE__ */ (() => {
	const NativeResponse = globalThis.Response;
	const STATUS_CODES = globalThis.process?.getBuiltinModule?.("node:http")?.STATUS_CODES || {};
	class NodeResponse {
		#body;
		#init;
		#headers;
		#response;
		constructor(body, init) {
			this.#body = body;
			this.#init = init;
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeResponse;
		}
		get status() {
			return this.#response?.status || this.#init?.status || 200;
		}
		get statusText() {
			return this.#response?.statusText || this.#init?.statusText || STATUS_CODES[this.status] || "";
		}
		get headers() {
			if (this.#response) return this.#response.headers;
			if (this.#headers) return this.#headers;
			const initHeaders = this.#init?.headers;
			return this.#headers = initHeaders instanceof Headers ? initHeaders : new Headers(initHeaders);
		}
		get ok() {
			if (this.#response) return this.#response.ok;
			const status = this.status;
			return status >= 200 && status < 300;
		}
		get _response() {
			if (this.#response) return this.#response;
			let body = this.#body;
			if (body && typeof body.pipe === "function" && !(body instanceof Readable)) {
				const stream = new PassThrough();
				body.pipe(stream);
				const abort = body.abort;
				if (abort) stream.once("close", () => abort());
				body = stream;
			}
			this.#response = new NativeResponse(body, this.#headers ? {
				...this.#init,
				headers: this.#headers
			} : this.#init);
			this.#init = void 0;
			this.#headers = void 0;
			this.#body = void 0;
			return this.#response;
		}
		_toNodeResponse() {
			const status = this.status;
			const statusText = this.statusText;
			let body;
			let contentType;
			let contentLength;
			if (this.#response) body = this.#response.body;
			else if (this.#body) if (this.#body instanceof ReadableStream) body = this.#body;
			else if (typeof this.#body === "string") {
				body = this.#body;
				contentType = "text/plain; charset=UTF-8";
				contentLength = Buffer.byteLength(this.#body);
			} else if (this.#body instanceof ArrayBuffer) {
				body = Buffer.from(this.#body);
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof Uint8Array) {
				body = this.#body;
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof DataView) {
				body = Buffer.from(this.#body.buffer);
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof Blob) {
				body = this.#body.stream();
				contentType = this.#body.type;
				contentLength = this.#body.size;
			} else if (typeof this.#body.pipe === "function") body = this.#body;
			else body = this._response.body;
			const headers = [];
			const initHeaders = this.#init?.headers;
			const headerEntries = this.#response?.headers || this.#headers || (initHeaders ? Array.isArray(initHeaders) ? initHeaders : initHeaders?.entries ? initHeaders.entries() : Object.entries(initHeaders).map(([k, v]) => [k.toLowerCase(), v]) : void 0);
			let hasContentTypeHeader;
			let hasContentLength;
			if (headerEntries) for (const [key, value] of headerEntries) {
				if (Array.isArray(value)) for (const v of value) headers.push([key, v]);
				else headers.push([key, value]);
				if (key === "content-type") hasContentTypeHeader = true;
				else if (key === "content-length") hasContentLength = true;
			}
			if (contentType && !hasContentTypeHeader) headers.push(["content-type", contentType]);
			if (contentLength && !hasContentLength) headers.push(["content-length", String(contentLength)]);
			this.#init = void 0;
			this.#headers = void 0;
			this.#response = void 0;
			this.#body = void 0;
			return {
				status,
				statusText,
				headers,
				body
			};
		}
	}
	lazyInherit(NodeResponse.prototype, NativeResponse.prototype, "_response");
	Object.setPrototypeOf(NodeResponse, NativeResponse);
	Object.setPrototypeOf(NodeResponse.prototype, NativeResponse.prototype);
	return NodeResponse;
})();
const kEventNS = "h3.internal.event.";
const kEventRes = /* @__PURE__ */ Symbol.for(`${kEventNS}res`);
const kEventResHeaders = /* @__PURE__ */ Symbol.for(`${kEventNS}res.headers`);
var H3Event = class {
	app;
	req;
	url;
	context;
	static __is_event__ = true;
	constructor(req, context, app) {
		this.context = context || req.context || new NullProtoObj();
		this.req = req;
		this.app = app;
		const _url = req._url;
		this.url = _url && _url instanceof URL ? _url : new FastURL(req.url);
	}
	get res() {
		return this[kEventRes] ||= new H3EventResponse();
	}
	get runtime() {
		return this.req.runtime;
	}
	waitUntil(promise) {
		this.req.waitUntil?.(promise);
	}
	toString() {
		return `[${this.req.method}] ${this.req.url}`;
	}
	toJSON() {
		return this.toString();
	}
	get node() {
		return this.req.runtime?.node;
	}
	get headers() {
		return this.req.headers;
	}
	get path() {
		return this.url.pathname + this.url.search;
	}
	get method() {
		return this.req.method;
	}
};
var H3EventResponse = class {
	status;
	statusText;
	get headers() {
		return this[kEventResHeaders] ||= new Headers();
	}
};
const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
	return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
	if (!statusCode) return defaultStatusCode;
	if (typeof statusCode === "string") statusCode = +statusCode;
	if (statusCode < 100 || statusCode > 599) return defaultStatusCode;
	return statusCode;
}
var HTTPError = class HTTPError extends Error {
	get name() {
		return "HTTPError";
	}
	status;
	statusText;
	headers;
	cause;
	data;
	body;
	unhandled;
	static isError(input) {
		return input instanceof Error && input?.name === "HTTPError";
	}
	static status(status, statusText, details) {
		return new HTTPError({
			...details,
			statusText,
			status
		});
	}
	constructor(arg1, arg2) {
		let messageInput;
		let details;
		if (typeof arg1 === "string") {
			messageInput = arg1;
			details = arg2;
		} else details = arg1;
		const status = sanitizeStatusCode(details?.status || (details?.cause)?.status || details?.status || details?.statusCode, 500);
		const statusText = sanitizeStatusMessage(details?.statusText || (details?.cause)?.statusText || details?.statusText || details?.statusMessage);
		const message = messageInput || details?.message || (details?.cause)?.message || details?.statusText || details?.statusMessage || [
			"HTTPError",
			status,
			statusText
		].filter(Boolean).join(" ");
		super(message, { cause: details });
		this.cause = details;
		this.status = status;
		this.statusText = statusText || void 0;
		const rawHeaders = details?.headers || (details?.cause)?.headers;
		this.headers = rawHeaders ? new Headers(rawHeaders) : void 0;
		this.unhandled = details?.unhandled ?? (details?.cause)?.unhandled ?? void 0;
		this.data = details?.data;
		this.body = details?.body;
	}
	get statusCode() {
		return this.status;
	}
	get statusMessage() {
		return this.statusText;
	}
	toJSON() {
		const unhandled = this.unhandled;
		return {
			status: this.status,
			statusText: this.statusText,
			unhandled,
			message: unhandled ? "HTTPError" : this.message,
			data: unhandled ? void 0 : this.data,
			...unhandled ? void 0 : this.body
		};
	}
};
function isJSONSerializable(value, _type) {
	if (value === null || value === void 0) return true;
	if (_type !== "object") return _type === "boolean" || _type === "number" || _type === "string";
	if (typeof value.toJSON === "function") return true;
	if (Array.isArray(value)) return true;
	if (typeof value.pipe === "function" || typeof value.pipeTo === "function") return false;
	if (value instanceof NullProtoObj) return true;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
const kNotFound = /* @__PURE__ */ Symbol.for("h3.notFound");
const kHandled = /* @__PURE__ */ Symbol.for("h3.handled");
function toResponse(val, event, config = {}) {
	if (typeof val?.then === "function") return (val.catch?.((error) => error) || Promise.resolve(val)).then((resolvedVal) => toResponse(resolvedVal, event, config));
	const response = prepareResponse(val, event, config);
	if (typeof response?.then === "function") return toResponse(response, event, config);
	const { onResponse } = config;
	return onResponse ? Promise.resolve(onResponse(response, event)).then(() => response) : response;
}
var HTTPResponse = class {
	#headers;
	#init;
	body;
	constructor(body, init) {
		this.body = body;
		this.#init = init;
	}
	get status() {
		return this.#init?.status || 200;
	}
	get statusText() {
		return this.#init?.statusText || "OK";
	}
	get headers() {
		return this.#headers ||= new Headers(this.#init?.headers);
	}
};
function prepareResponse(val, event, config, nested) {
	if (val === kHandled) return new NodeResponse(null);
	if (val === kNotFound) val = new HTTPError({
		status: 404,
		message: `Cannot find any route matching [${event.req.method}] ${event.url}`
	});
	if (val && val instanceof Error) {
		const isHTTPError = HTTPError.isError(val);
		const error = isHTTPError ? val : new HTTPError(val);
		if (!isHTTPError) {
			error.unhandled = true;
			if (val?.stack) error.stack = val.stack;
		}
		if (error.unhandled && !config.silent) console.error(error);
		const { onError } = config;
		return onError && !nested ? Promise.resolve(onError(error, event)).catch((error) => error).then((newVal) => prepareResponse(newVal ?? val, event, config, true)) : errorResponse(error, config.debug);
	}
	const preparedRes = event[kEventRes];
	const preparedHeaders = preparedRes?.[kEventResHeaders];
	event[kEventRes] = void 0;
	if (!(val instanceof Response)) {
		const res = prepareResponseBody(val, event, config);
		const status = res.status || preparedRes?.status;
		return new NodeResponse(nullBody(event.req.method, status) ? null : res.body, {
			status,
			statusText: res.statusText || preparedRes?.statusText,
			headers: res.headers && preparedHeaders ? mergeHeaders$1(res.headers, preparedHeaders) : res.headers || preparedHeaders
		});
	}
	if (!preparedHeaders || nested || !val.ok) return val;
	try {
		mergeHeaders$1(val.headers, preparedHeaders, val.headers);
		return val;
	} catch {
		return new NodeResponse(nullBody(event.req.method, val.status) ? null : val.body, {
			status: val.status,
			statusText: val.statusText,
			headers: mergeHeaders$1(val.headers, preparedHeaders)
		});
	}
}
function mergeHeaders$1(base, overrides, target = new Headers(base)) {
	for (const [name, value] of overrides) if (name === "set-cookie") target.append(name, value);
	else target.set(name, value);
	return target;
}
const frozen = (name) => (...args) => {
	throw new Error(`Headers are frozen (${name} ${args.join(", ")})`);
};
var FrozenHeaders = class extends Headers {
	set = frozen("set");
	append = frozen("append");
	delete = frozen("delete");
};
const emptyHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-length": "0" });
const jsonHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-type": "application/json;charset=UTF-8" });
function prepareResponseBody(val, event, config) {
	if (val === null || val === void 0) return {
		body: "",
		headers: emptyHeaders
	};
	const valType = typeof val;
	if (valType === "string") return { body: val };
	if (val instanceof Uint8Array) {
		event.res.headers.set("content-length", val.byteLength.toString());
		return { body: val };
	}
	if (val instanceof HTTPResponse || val?.constructor?.name === "HTTPResponse") return val;
	if (isJSONSerializable(val, valType)) return {
		body: JSON.stringify(val, void 0, config.debug ? 2 : void 0),
		headers: jsonHeaders
	};
	if (valType === "bigint") return {
		body: val.toString(),
		headers: jsonHeaders
	};
	if (val instanceof Blob) {
		const headers = new Headers({
			"content-type": val.type,
			"content-length": val.size.toString()
		});
		let filename = val.name;
		if (filename) {
			filename = encodeURIComponent(filename);
			headers.set("content-disposition", `filename="${filename}"; filename*=UTF-8''${filename}`);
		}
		return {
			body: val.stream(),
			headers
		};
	}
	if (valType === "symbol") return { body: val.toString() };
	if (valType === "function") return { body: `${val.name}()` };
	return { body: val };
}
function nullBody(method, status) {
	return method === "HEAD" || status === 100 || status === 101 || status === 102 || status === 204 || status === 205 || status === 304;
}
function errorResponse(error, debug) {
	return new NodeResponse(JSON.stringify({
		...error.toJSON(),
		stack: debug && error.stack ? error.stack.split("\n").map((l) => l.trim()) : void 0
	}, void 0, debug ? 2 : void 0), {
		status: error.status,
		statusText: error.statusText,
		headers: error.headers ? mergeHeaders$1(jsonHeaders, error.headers) : new Headers(jsonHeaders)
	});
}
function callMiddleware(event, middleware, handler, index = 0) {
	if (index === middleware.length) return handler(event);
	const fn = middleware[index];
	let nextCalled;
	let nextResult;
	const next = () => {
		if (nextCalled) return nextResult;
		nextCalled = true;
		nextResult = callMiddleware(event, middleware, handler, index + 1);
		return nextResult;
	};
	const ret = fn(event, next);
	return isUnhandledResponse(ret) ? next() : typeof ret?.then === "function" ? ret.then((resolved) => isUnhandledResponse(resolved) ? next() : resolved) : ret;
}
function isUnhandledResponse(val) {
	return val === void 0 || val === kNotFound;
}
function defineHandler(input) {
	if (typeof input === "function") return handlerWithFetch(input);
	const handler = input.handler || (input.fetch ? function _fetchHandler(event) {
		return input.fetch(event.req);
	} : NoHandler);
	return Object.assign(handlerWithFetch(input.middleware?.length ? function _handlerMiddleware(event) {
		return callMiddleware(event, input.middleware, handler);
	} : handler), input);
}
function handlerWithFetch(handler) {
	if ("fetch" in handler) return handler;
	return Object.assign(handler, { fetch: (req) => {
		if (typeof req === "string") req = new URL(req, "http://_");
		if (req instanceof URL) req = new Request(req);
		const event = new H3Event(req);
		try {
			return Promise.resolve(toResponse(handler(event), event));
		} catch (error) {
			return Promise.resolve(toResponse(error, event));
		}
	} });
}
function defineLazyEventHandler(loader) {
	let handler;
	let promise;
	const resolveLazyHandler = () => {
		if (handler) return Promise.resolve(handler);
		return promise ??= Promise.resolve(loader()).then((r) => {
			handler = toEventHandler(r) || toEventHandler(r.default);
			if (typeof handler !== "function") throw new TypeError("Invalid lazy handler", { cause: { resolved: r } });
			return handler;
		});
	};
	return defineHandler(function lazyHandler(event) {
		return handler ? handler(event) : resolveLazyHandler().then((r) => r(event));
	});
}
function toEventHandler(handler) {
	if (typeof handler === "function") return handler;
	if (typeof handler?.handler === "function") return handler.handler;
	if (typeof handler?.fetch === "function") return function _fetchHandler(event) {
		return handler.fetch(event.req);
	};
}
const NoHandler = () => kNotFound;
var H3Core = class {
	config;
	"~middleware";
	"~routes" = [];
	constructor(config = {}) {
		this["~middleware"] = [];
		this.config = config;
		this.fetch = this.fetch.bind(this);
		this.handler = this.handler.bind(this);
	}
	fetch(request) {
		return this["~request"](request);
	}
	handler(event) {
		const route = this["~findRoute"](event);
		if (route) {
			event.context.params = route.params;
			event.context.matchedRoute = route.data;
		}
		const routeHandler = route?.data.handler || NoHandler;
		const middleware = this["~getMiddleware"](event, route);
		return middleware.length > 0 ? callMiddleware(event, middleware, routeHandler) : routeHandler(event);
	}
	"~request"(request, context) {
		const event = new H3Event(request, context, this);
		let handlerRes;
		try {
			if (this.config.onRequest) {
				const hookRes = this.config.onRequest(event);
				handlerRes = typeof hookRes?.then === "function" ? hookRes.then(() => this.handler(event)) : this.handler(event);
			} else handlerRes = this.handler(event);
		} catch (error) {
			handlerRes = Promise.reject(error);
		}
		return toResponse(handlerRes, event, this.config);
	}
	"~findRoute"(_event) {}
	"~addRoute"(_route) {
		this["~routes"].push(_route);
	}
	"~getMiddleware"(_event, route) {
		const routeMiddleware = route?.data.middleware;
		const globalMiddleware = this["~middleware"];
		return routeMiddleware ? [...globalMiddleware, ...routeMiddleware] : globalMiddleware;
	}
};
new TextEncoder();
function defineWebSocketHandler(hooks) {
	return defineHandler(function _webSocketHandler(event) {
		const crossws = typeof hooks === "function" ? hooks(event) : hooks;
		return Object.assign(new Response("WebSocket upgrade is required.", { status: 426 }), { crossws });
	});
}
export { NodeResponse as a, defineWebSocketHandler as i, HTTPResponse as n, defineLazyEventHandler as r, H3Core as t };
```

```js [.vercel/output/functions/__server.func/_libs/hookable.mjs]
function callHooks(hooks, args, startIndex, task) {
	for (let i = startIndex; i < hooks.length; i += 1) try {
		const result = task ? task.run(() => hooks[i](...args)) : hooks[i](...args);
		if (result instanceof Promise) return result.then(() => callHooks(hooks, args, i + 1, task));
	} catch (error) {
		return Promise.reject(error);
	}
}
var HookableCore = class {
	_hooks;
	constructor() {
		this._hooks = {};
	}
	hook(name, fn) {
		if (!name || typeof fn !== "function") return () => {};
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(fn);
		return () => {
			if (fn) {
				this.removeHook(name, fn);
				fn = void 0;
			}
		};
	}
	removeHook(name, function_) {
		const hooks = this._hooks[name];
		if (hooks) {
			const index = hooks.indexOf(function_);
			if (index !== -1) hooks.splice(index, 1);
			if (hooks.length === 0) this._hooks[name] = void 0;
		}
	}
	callHook(name, ...args) {
		const hooks = this._hooks[name];
		if (!hooks || hooks.length === 0) return;
		return callHooks(hooks, args, 0);
	}
};
export { HookableCore as t };
```

```js [.vercel/output/functions/_ws.func/_chunks/renderer-template.mjs]
import { n as HTTPResponse } from "../_libs/h3+rou3+srvx.mjs";
const rendererTemplate = () => new HTTPResponse("<html lang=\"en\" data-theme=\"dark\">\n  <head>\n    <title>CrossWS Test Page</title>\n    <script src=\"https://cdn.tailwindcss.com\"><\/script>\n    <style>\n      body {\n        background-color: #1a1a1a;\n      }\n    </style>\n    <script type=\"module\">\n      import { createApp, reactive, nextTick } from \"https://esm.sh/petite-vue@0.4.1\";\n\n      let ws;\n\n      const store = reactive({\n        message: \"\",\n        messages: [],\n      });\n\n      const scroll = () => {\n        nextTick(() => {\n          const el = document.querySelector(\"#messages\");\n          el.scrollTop = el.scrollHeight;\n          el.scrollTo({\n            top: el.scrollHeight,\n            behavior: \"smooth\",\n          });\n        });\n      };\n\n      const format = async () => {\n        for (const message of store.messages) {\n          if (!message._fmt && message.text.startsWith(\"{\")) {\n            message._fmt = true;\n            const { codeToHtml } = await import(\"https://esm.sh/shiki@1.0.0\");\n            const str = JSON.stringify(JSON.parse(message.text), null, 2);\n            message.formattedText = await codeToHtml(str, {\n              lang: \"json\",\n              theme: \"dark-plus\",\n            });\n          }\n        }\n      };\n\n      const log = (user, ...args) => {\n        console.log(\"[ws]\", user, ...args);\n        store.messages.push({\n          text: args.join(\" \"),\n          formattedText: \"\",\n          user: user,\n          date: new Date().toLocaleString(),\n        });\n        scroll();\n        format();\n      };\n\n      const connect = async () => {\n        const isSecure = location.protocol === \"https:\";\n        const url = (isSecure ? \"wss://\" : \"ws://\") + location.host + \"/_ws\";\n        if (ws) {\n          log(\"ws\", \"Closing previous connection before reconnecting...\");\n          ws.close();\n          clear();\n        }\n\n        log(\"ws\", \"Connecting to\", url, \"...\");\n        ws = new WebSocket(url);\n\n        ws.addEventListener(\"message\", async (event) => {\n          let data = typeof event.data === \"string\" ? event.data : await event.data.text();\n          const { user = \"system\", message = \"\" } = data.startsWith(\"{\")\n            ? JSON.parse(data)\n            : { message: data };\n          log(user, typeof message === \"string\" ? message : JSON.stringify(message));\n        });\n\n        await new Promise((resolve) => ws.addEventListener(\"open\", resolve));\n        log(\"ws\", \"Connected!\");\n      };\n\n      const clear = () => {\n        store.messages.splice(0, store.messages.length);\n        log(\"system\", \"previous messages cleared\");\n      };\n\n      const send = () => {\n        console.log(\"sending message...\");\n        if (store.message) {\n          ws.send(store.message);\n        }\n        store.message = \"\";\n      };\n\n      const ping = () => {\n        log(\"ws\", \"Sending ping\");\n        ws.send(\"ping\");\n      };\n\n      createApp({\n        store,\n        send,\n        ping,\n        clear,\n        connect,\n        rand: Math.random(),\n      }).mount();\n\n      await connect();\n    <\/script>\n  </head>\n  <body class=\"h-screen flex flex-col justify-between\">\n    <main v-scope=\"{}\">\n      <!-- Messages -->\n      <div id=\"messages\" class=\"flex-grow flex flex-col justify-end px-4 py-8\">\n        <div class=\"flex items-center mb-4\" v-for=\"message in store.messages\">\n          <div class=\"flex flex-col\">\n            <p class=\"text-gray-500 mb-1 text-xs ml-10\">{{ message.user }}</p>\n            <div class=\"flex items-center\">\n              <img\n                :src=\"'https://www.gravatar.com/avatar/' + encodeURIComponent(message.user + rand) + '?s=512&d=monsterid'\"\n                alt=\"Avatar\"\n                class=\"w-8 h-8 rounded-full\"\n              />\n              <div class=\"ml-2 bg-gray-800 rounded-lg p-2\">\n                <p\n                  v-if=\"message.formattedText\"\n                  class=\"overflow-x-scroll\"\n                  v-html=\"message.formattedText\"\n                ></p>\n                <p v-else class=\"text-white\">{{ message.text }}</p>\n              </div>\n            </div>\n            <p class=\"text-gray-500 mt-1 text-xs ml-10\">{{ message.date }}</p>\n          </div>\n        </div>\n      </div>\n\n      <!-- Chatbox -->\n      <div class=\"bg-gray-800 px-4 py-2 flex items-center justify-between fixed bottom-0 w-full\">\n        <div class=\"w-full min-w-6\">\n          <input\n            type=\"text\"\n            placeholder=\"Type your message...\"\n            class=\"w-full rounded-l-lg px-4 py-2 bg-gray-700 text-white focus:outline-none focus:ring focus:border-blue-300\"\n            @keydown.enter=\"send\"\n            v-model=\"store.message\"\n          />\n        </div>\n        <div class=\"flex\">\n          <button class=\"bg-blue-500 hover:bg-blue-600 text-white py-2 px-4\" @click=\"send\">\n            Send\n          </button>\n          <button class=\"bg-blue-500 hover:bg-blue-600 text-white py-2 px-4\" @click=\"ping\">\n            Ping\n          </button>\n          <button class=\"bg-blue-500 hover:bg-blue-600 text-white py-2 px-4\" @click=\"connect\">\n            Reconnect\n          </button>\n          <button\n            class=\"bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-r-lg\"\n            @click=\"clear\"\n          >\n            Clear\n          </button>\n        </div>\n      </div>\n    </main>\n  </body>\n</html>\n`\n", { headers: { "content-type": "text/html; charset=utf-8" } });
function renderIndexHTML(event) {
	return rendererTemplate(event.req);
}
export { renderIndexHTML as default };
```

```js [.vercel/output/functions/_ws.func/_libs/h3+rou3+srvx.mjs]
import { PassThrough, Readable } from "node:stream";
const NullProtoObj = /* @__PURE__ */ (() => {
	const e = function() {};
	return e.prototype = Object.create(null), Object.freeze(e.prototype), e;
})();
function lazyInherit(target, source, sourceKey) {
	for (const key of [...Object.getOwnPropertyNames(source), ...Object.getOwnPropertySymbols(source)]) {
		if (key === "constructor") continue;
		const targetDesc = Object.getOwnPropertyDescriptor(target, key);
		const desc = Object.getOwnPropertyDescriptor(source, key);
		let modified = false;
		if (desc.get) {
			modified = true;
			desc.get = targetDesc?.get || function() {
				return this[sourceKey][key];
			};
		}
		if (desc.set) {
			modified = true;
			desc.set = targetDesc?.set || function(value) {
				this[sourceKey][key] = value;
			};
		}
		if (!targetDesc?.value && typeof desc.value === "function") {
			modified = true;
			desc.value = function(...args) {
				return this[sourceKey][key](...args);
			};
		}
		if (modified) Object.defineProperty(target, key, desc);
	}
}
const FastURL = /* @__PURE__ */ (() => {
	const NativeURL = globalThis.URL;
	const FastURL = class URL {
		#url;
		#href;
		#protocol;
		#host;
		#pathname;
		#search;
		#searchParams;
		#pos;
		constructor(url) {
			if (typeof url === "string") this.#href = url;
			else {
				this.#protocol = url.protocol;
				this.#host = url.host;
				this.#pathname = url.pathname;
				this.#search = url.search;
			}
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeURL;
		}
		get _url() {
			if (this.#url) return this.#url;
			this.#url = new NativeURL(this.href);
			this.#href = void 0;
			this.#protocol = void 0;
			this.#host = void 0;
			this.#pathname = void 0;
			this.#search = void 0;
			this.#searchParams = void 0;
			this.#pos = void 0;
			return this.#url;
		}
		get href() {
			if (this.#url) return this.#url.href;
			if (!this.#href) this.#href = `${this.#protocol || "http:"}//${this.#host || "localhost"}${this.#pathname || "/"}${this.#search || ""}`;
			return this.#href;
		}
		#getPos() {
			if (!this.#pos) {
				const url = this.href;
				const protoIndex = url.indexOf("://");
				const pathnameIndex = protoIndex === -1 ? -1 : url.indexOf("/", protoIndex + 4);
				this.#pos = [
					protoIndex,
					pathnameIndex,
					pathnameIndex === -1 ? -1 : url.indexOf("?", pathnameIndex)
				];
			}
			return this.#pos;
		}
		get pathname() {
			if (this.#url) return this.#url.pathname;
			if (this.#pathname === void 0) {
				const [, pathnameIndex, queryIndex] = this.#getPos();
				if (pathnameIndex === -1) return this._url.pathname;
				this.#pathname = this.href.slice(pathnameIndex, queryIndex === -1 ? void 0 : queryIndex);
			}
			return this.#pathname;
		}
		get search() {
			if (this.#url) return this.#url.search;
			if (this.#search === void 0) {
				const [, pathnameIndex, queryIndex] = this.#getPos();
				if (pathnameIndex === -1) return this._url.search;
				const url = this.href;
				this.#search = queryIndex === -1 || queryIndex === url.length - 1 ? "" : url.slice(queryIndex);
			}
			return this.#search;
		}
		get searchParams() {
			if (this.#url) return this.#url.searchParams;
			if (!this.#searchParams) this.#searchParams = new URLSearchParams(this.search);
			return this.#searchParams;
		}
		get protocol() {
			if (this.#url) return this.#url.protocol;
			if (this.#protocol === void 0) {
				const [protocolIndex] = this.#getPos();
				if (protocolIndex === -1) return this._url.protocol;
				this.#protocol = this.href.slice(0, protocolIndex + 1);
			}
			return this.#protocol;
		}
		toString() {
			return this.href;
		}
		toJSON() {
			return this.href;
		}
	};
	lazyInherit(FastURL.prototype, NativeURL.prototype, "_url");
	Object.setPrototypeOf(FastURL.prototype, NativeURL.prototype);
	Object.setPrototypeOf(FastURL, NativeURL);
	return FastURL;
})();
const NodeResponse = /* @__PURE__ */ (() => {
	const NativeResponse = globalThis.Response;
	const STATUS_CODES = globalThis.process?.getBuiltinModule?.("node:http")?.STATUS_CODES || {};
	class NodeResponse {
		#body;
		#init;
		#headers;
		#response;
		constructor(body, init) {
			this.#body = body;
			this.#init = init;
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeResponse;
		}
		get status() {
			return this.#response?.status || this.#init?.status || 200;
		}
		get statusText() {
			return this.#response?.statusText || this.#init?.statusText || STATUS_CODES[this.status] || "";
		}
		get headers() {
			if (this.#response) return this.#response.headers;
			if (this.#headers) return this.#headers;
			const initHeaders = this.#init?.headers;
			return this.#headers = initHeaders instanceof Headers ? initHeaders : new Headers(initHeaders);
		}
		get ok() {
			if (this.#response) return this.#response.ok;
			const status = this.status;
			return status >= 200 && status < 300;
		}
		get _response() {
			if (this.#response) return this.#response;
			let body = this.#body;
			if (body && typeof body.pipe === "function" && !(body instanceof Readable)) {
				const stream = new PassThrough();
				body.pipe(stream);
				const abort = body.abort;
				if (abort) stream.once("close", () => abort());
				body = stream;
			}
			this.#response = new NativeResponse(body, this.#headers ? {
				...this.#init,
				headers: this.#headers
			} : this.#init);
			this.#init = void 0;
			this.#headers = void 0;
			this.#body = void 0;
			return this.#response;
		}
		_toNodeResponse() {
			const status = this.status;
			const statusText = this.statusText;
			let body;
			let contentType;
			let contentLength;
			if (this.#response) body = this.#response.body;
			else if (this.#body) if (this.#body instanceof ReadableStream) body = this.#body;
			else if (typeof this.#body === "string") {
				body = this.#body;
				contentType = "text/plain; charset=UTF-8";
				contentLength = Buffer.byteLength(this.#body);
			} else if (this.#body instanceof ArrayBuffer) {
				body = Buffer.from(this.#body);
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof Uint8Array) {
				body = this.#body;
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof DataView) {
				body = Buffer.from(this.#body.buffer);
				contentLength = this.#body.byteLength;
			} else if (this.#body instanceof Blob) {
				body = this.#body.stream();
				contentType = this.#body.type;
				contentLength = this.#body.size;
			} else if (typeof this.#body.pipe === "function") body = this.#body;
			else body = this._response.body;
			const headers = [];
			const initHeaders = this.#init?.headers;
			const headerEntries = this.#response?.headers || this.#headers || (initHeaders ? Array.isArray(initHeaders) ? initHeaders : initHeaders?.entries ? initHeaders.entries() : Object.entries(initHeaders).map(([k, v]) => [k.toLowerCase(), v]) : void 0);
			let hasContentTypeHeader;
			let hasContentLength;
			if (headerEntries) for (const [key, value] of headerEntries) {
				if (Array.isArray(value)) for (const v of value) headers.push([key, v]);
				else headers.push([key, value]);
				if (key === "content-type") hasContentTypeHeader = true;
				else if (key === "content-length") hasContentLength = true;
			}
			if (contentType && !hasContentTypeHeader) headers.push(["content-type", contentType]);
			if (contentLength && !hasContentLength) headers.push(["content-length", String(contentLength)]);
			this.#init = void 0;
			this.#headers = void 0;
			this.#response = void 0;
			this.#body = void 0;
			return {
				status,
				statusText,
				headers,
				body
			};
		}
	}
	lazyInherit(NodeResponse.prototype, NativeResponse.prototype, "_response");
	Object.setPrototypeOf(NodeResponse, NativeResponse);
	Object.setPrototypeOf(NodeResponse.prototype, NativeResponse.prototype);
	return NodeResponse;
})();
const kEventNS = "h3.internal.event.";
const kEventRes = /* @__PURE__ */ Symbol.for(`${kEventNS}res`);
const kEventResHeaders = /* @__PURE__ */ Symbol.for(`${kEventNS}res.headers`);
var H3Event = class {
	app;
	req;
	url;
	context;
	static __is_event__ = true;
	constructor(req, context, app) {
		this.context = context || req.context || new NullProtoObj();
		this.req = req;
		this.app = app;
		const _url = req._url;
		this.url = _url && _url instanceof URL ? _url : new FastURL(req.url);
	}
	get res() {
		return this[kEventRes] ||= new H3EventResponse();
	}
	get runtime() {
		return this.req.runtime;
	}
	waitUntil(promise) {
		this.req.waitUntil?.(promise);
	}
	toString() {
		return `[${this.req.method}] ${this.req.url}`;
	}
	toJSON() {
		return this.toString();
	}
	get node() {
		return this.req.runtime?.node;
	}
	get headers() {
		return this.req.headers;
	}
	get path() {
		return this.url.pathname + this.url.search;
	}
	get method() {
		return this.req.method;
	}
};
var H3EventResponse = class {
	status;
	statusText;
	get headers() {
		return this[kEventResHeaders] ||= new Headers();
	}
};
const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
	return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
	if (!statusCode) return defaultStatusCode;
	if (typeof statusCode === "string") statusCode = +statusCode;
	if (statusCode < 100 || statusCode > 599) return defaultStatusCode;
	return statusCode;
}
var HTTPError = class HTTPError extends Error {
	get name() {
		return "HTTPError";
	}
	status;
	statusText;
	headers;
	cause;
	data;
	body;
	unhandled;
	static isError(input) {
		return input instanceof Error && input?.name === "HTTPError";
	}
	static status(status, statusText, details) {
		return new HTTPError({
			...details,
			statusText,
			status
		});
	}
	constructor(arg1, arg2) {
		let messageInput;
		let details;
		if (typeof arg1 === "string") {
			messageInput = arg1;
			details = arg2;
		} else details = arg1;
		const status = sanitizeStatusCode(details?.status || (details?.cause)?.status || details?.status || details?.statusCode, 500);
		const statusText = sanitizeStatusMessage(details?.statusText || (details?.cause)?.statusText || details?.statusText || details?.statusMessage);
		const message = messageInput || details?.message || (details?.cause)?.message || details?.statusText || details?.statusMessage || [
			"HTTPError",
			status,
			statusText
		].filter(Boolean).join(" ");
		super(message, { cause: details });
		this.cause = details;
		this.status = status;
		this.statusText = statusText || void 0;
		const rawHeaders = details?.headers || (details?.cause)?.headers;
		this.headers = rawHeaders ? new Headers(rawHeaders) : void 0;
		this.unhandled = details?.unhandled ?? (details?.cause)?.unhandled ?? void 0;
		this.data = details?.data;
		this.body = details?.body;
	}
	get statusCode() {
		return this.status;
	}
	get statusMessage() {
		return this.statusText;
	}
	toJSON() {
		const unhandled = this.unhandled;
		return {
			status: this.status,
			statusText: this.statusText,
			unhandled,
			message: unhandled ? "HTTPError" : this.message,
			data: unhandled ? void 0 : this.data,
			...unhandled ? void 0 : this.body
		};
	}
};
function isJSONSerializable(value, _type) {
	if (value === null || value === void 0) return true;
	if (_type !== "object") return _type === "boolean" || _type === "number" || _type === "string";
	if (typeof value.toJSON === "function") return true;
	if (Array.isArray(value)) return true;
	if (typeof value.pipe === "function" || typeof value.pipeTo === "function") return false;
	if (value instanceof NullProtoObj) return true;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
const kNotFound = /* @__PURE__ */ Symbol.for("h3.notFound");
const kHandled = /* @__PURE__ */ Symbol.for("h3.handled");
function toResponse(val, event, config = {}) {
	if (typeof val?.then === "function") return (val.catch?.((error) => error) || Promise.resolve(val)).then((resolvedVal) => toResponse(resolvedVal, event, config));
	const response = prepareResponse(val, event, config);
	if (typeof response?.then === "function") return toResponse(response, event, config);
	const { onResponse } = config;
	return onResponse ? Promise.resolve(onResponse(response, event)).then(() => response) : response;
}
var HTTPResponse = class {
	#headers;
	#init;
	body;
	constructor(body, init) {
		this.body = body;
		this.#init = init;
	}
	get status() {
		return this.#init?.status || 200;
	}
	get statusText() {
		return this.#init?.statusText || "OK";
	}
	get headers() {
		return this.#headers ||= new Headers(this.#init?.headers);
	}
};
function prepareResponse(val, event, config, nested) {
	if (val === kHandled) return new NodeResponse(null);
	if (val === kNotFound) val = new HTTPError({
		status: 404,
		message: `Cannot find any route matching [${event.req.method}] ${event.url}`
	});
	if (val && val instanceof Error) {
		const isHTTPError = HTTPError.isError(val);
		const error = isHTTPError ? val : new HTTPError(val);
		if (!isHTTPError) {
			error.unhandled = true;
			if (val?.stack) error.stack = val.stack;
		}
		if (error.unhandled && !config.silent) console.error(error);
		const { onError } = config;
		return onError && !nested ? Promise.resolve(onError(error, event)).catch((error) => error).then((newVal) => prepareResponse(newVal ?? val, event, config, true)) : errorResponse(error, config.debug);
	}
	const preparedRes = event[kEventRes];
	const preparedHeaders = preparedRes?.[kEventResHeaders];
	event[kEventRes] = void 0;
	if (!(val instanceof Response)) {
		const res = prepareResponseBody(val, event, config);
		const status = res.status || preparedRes?.status;
		return new NodeResponse(nullBody(event.req.method, status) ? null : res.body, {
			status,
			statusText: res.statusText || preparedRes?.statusText,
			headers: res.headers && preparedHeaders ? mergeHeaders$1(res.headers, preparedHeaders) : res.headers || preparedHeaders
		});
	}
	if (!preparedHeaders || nested || !val.ok) return val;
	try {
		mergeHeaders$1(val.headers, preparedHeaders, val.headers);
		return val;
	} catch {
		return new NodeResponse(nullBody(event.req.method, val.status) ? null : val.body, {
			status: val.status,
			statusText: val.statusText,
			headers: mergeHeaders$1(val.headers, preparedHeaders)
		});
	}
}
function mergeHeaders$1(base, overrides, target = new Headers(base)) {
	for (const [name, value] of overrides) if (name === "set-cookie") target.append(name, value);
	else target.set(name, value);
	return target;
}
const frozen = (name) => (...args) => {
	throw new Error(`Headers are frozen (${name} ${args.join(", ")})`);
};
var FrozenHeaders = class extends Headers {
	set = frozen("set");
	append = frozen("append");
	delete = frozen("delete");
};
const emptyHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-length": "0" });
const jsonHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-type": "application/json;charset=UTF-8" });
function prepareResponseBody(val, event, config) {
	if (val === null || val === void 0) return {
		body: "",
		headers: emptyHeaders
	};
	const valType = typeof val;
	if (valType === "string") return { body: val };
	if (val instanceof Uint8Array) {
		event.res.headers.set("content-length", val.byteLength.toString());
		return { body: val };
	}
	if (val instanceof HTTPResponse || val?.constructor?.name === "HTTPResponse") return val;
	if (isJSONSerializable(val, valType)) return {
		body: JSON.stringify(val, void 0, config.debug ? 2 : void 0),
		headers: jsonHeaders
	};
	if (valType === "bigint") return {
		body: val.toString(),
		headers: jsonHeaders
	};
	if (val instanceof Blob) {
		const headers = new Headers({
			"content-type": val.type,
			"content-length": val.size.toString()
		});
		let filename = val.name;
		if (filename) {
			filename = encodeURIComponent(filename);
			headers.set("content-disposition", `filename="${filename}"; filename*=UTF-8''${filename}`);
		}
		return {
			body: val.stream(),
			headers
		};
	}
	if (valType === "symbol") return { body: val.toString() };
	if (valType === "function") return { body: `${val.name}()` };
	return { body: val };
}
function nullBody(method, status) {
	return method === "HEAD" || status === 100 || status === 101 || status === 102 || status === 204 || status === 205 || status === 304;
}
function errorResponse(error, debug) {
	return new NodeResponse(JSON.stringify({
		...error.toJSON(),
		stack: debug && error.stack ? error.stack.split("\n").map((l) => l.trim()) : void 0
	}, void 0, debug ? 2 : void 0), {
		status: error.status,
		statusText: error.statusText,
		headers: error.headers ? mergeHeaders$1(jsonHeaders, error.headers) : new Headers(jsonHeaders)
	});
}
function callMiddleware(event, middleware, handler, index = 0) {
	if (index === middleware.length) return handler(event);
	const fn = middleware[index];
	let nextCalled;
	let nextResult;
	const next = () => {
		if (nextCalled) return nextResult;
		nextCalled = true;
		nextResult = callMiddleware(event, middleware, handler, index + 1);
		return nextResult;
	};
	const ret = fn(event, next);
	return isUnhandledResponse(ret) ? next() : typeof ret?.then === "function" ? ret.then((resolved) => isUnhandledResponse(resolved) ? next() : resolved) : ret;
}
function isUnhandledResponse(val) {
	return val === void 0 || val === kNotFound;
}
function defineHandler(input) {
	if (typeof input === "function") return handlerWithFetch(input);
	const handler = input.handler || (input.fetch ? function _fetchHandler(event) {
		return input.fetch(event.req);
	} : NoHandler);
	return Object.assign(handlerWithFetch(input.middleware?.length ? function _handlerMiddleware(event) {
		return callMiddleware(event, input.middleware, handler);
	} : handler), input);
}
function handlerWithFetch(handler) {
	if ("fetch" in handler) return handler;
	return Object.assign(handler, { fetch: (req) => {
		if (typeof req === "string") req = new URL(req, "http://_");
		if (req instanceof URL) req = new Request(req);
		const event = new H3Event(req);
		try {
			return Promise.resolve(toResponse(handler(event), event));
		} catch (error) {
			return Promise.resolve(toResponse(error, event));
		}
	} });
}
function defineLazyEventHandler(loader) {
	let handler;
	let promise;
	const resolveLazyHandler = () => {
		if (handler) return Promise.resolve(handler);
		return promise ??= Promise.resolve(loader()).then((r) => {
			handler = toEventHandler(r) || toEventHandler(r.default);
			if (typeof handler !== "function") throw new TypeError("Invalid lazy handler", { cause: { resolved: r } });
			return handler;
		});
	};
	return defineHandler(function lazyHandler(event) {
		return handler ? handler(event) : resolveLazyHandler().then((r) => r(event));
	});
}
function toEventHandler(handler) {
	if (typeof handler === "function") return handler;
	if (typeof handler?.handler === "function") return handler.handler;
	if (typeof handler?.fetch === "function") return function _fetchHandler(event) {
		return handler.fetch(event.req);
	};
}
const NoHandler = () => kNotFound;
var H3Core = class {
	config;
	"~middleware";
	"~routes" = [];
	constructor(config = {}) {
		this["~middleware"] = [];
		this.config = config;
		this.fetch = this.fetch.bind(this);
		this.handler = this.handler.bind(this);
	}
	fetch(request) {
		return this["~request"](request);
	}
	handler(event) {
		const route = this["~findRoute"](event);
		if (route) {
			event.context.params = route.params;
			event.context.matchedRoute = route.data;
		}
		const routeHandler = route?.data.handler || NoHandler;
		const middleware = this["~getMiddleware"](event, route);
		return middleware.length > 0 ? callMiddleware(event, middleware, routeHandler) : routeHandler(event);
	}
	"~request"(request, context) {
		const event = new H3Event(request, context, this);
		let handlerRes;
		try {
			if (this.config.onRequest) {
				const hookRes = this.config.onRequest(event);
				handlerRes = typeof hookRes?.then === "function" ? hookRes.then(() => this.handler(event)) : this.handler(event);
			} else handlerRes = this.handler(event);
		} catch (error) {
			handlerRes = Promise.reject(error);
		}
		return toResponse(handlerRes, event, this.config);
	}
	"~findRoute"(_event) {}
	"~addRoute"(_route) {
		this["~routes"].push(_route);
	}
	"~getMiddleware"(_event, route) {
		const routeMiddleware = route?.data.middleware;
		const globalMiddleware = this["~middleware"];
		return routeMiddleware ? [...globalMiddleware, ...routeMiddleware] : globalMiddleware;
	}
};
new TextEncoder();
function defineWebSocketHandler(hooks) {
	return defineHandler(function _webSocketHandler(event) {
		const crossws = typeof hooks === "function" ? hooks(event) : hooks;
		return Object.assign(new Response("WebSocket upgrade is required.", { status: 426 }), { crossws });
	});
}
export { NodeResponse as a, defineWebSocketHandler as i, HTTPResponse as n, defineLazyEventHandler as r, H3Core as t };
```

```js [.vercel/output/functions/_ws.func/_libs/hookable.mjs]
function callHooks(hooks, args, startIndex, task) {
	for (let i = startIndex; i < hooks.length; i += 1) try {
		const result = task ? task.run(() => hooks[i](...args)) : hooks[i](...args);
		if (result instanceof Promise) return result.then(() => callHooks(hooks, args, i + 1, task));
	} catch (error) {
		return Promise.reject(error);
	}
}
var HookableCore = class {
	_hooks;
	constructor() {
		this._hooks = {};
	}
	hook(name, fn) {
		if (!name || typeof fn !== "function") return () => {};
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(fn);
		return () => {
			if (fn) {
				this.removeHook(name, fn);
				fn = void 0;
			}
		};
	}
	removeHook(name, function_) {
		const hooks = this._hooks[name];
		if (hooks) {
			const index = hooks.indexOf(function_);
			if (index !== -1) hooks.splice(index, 1);
			if (hooks.length === 0) this._hooks[name] = void 0;
		}
	}
	callHook(name, ...args) {
		const hooks = this._hooks[name];
		if (!hooks || hooks.length === 0) return;
		return callHooks(hooks, args, 0);
	}
};
export { HookableCore as t };
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/websocket/README.md" -->

This example implements a simple chat room using WebSockets. Clients connect, send messages, and receive messages from other users in real-time. The server broadcasts messages to all connected clients using pub/sub channels.

## WebSocket Handler

Create a WebSocket route using `defineWebSocketHandler`.

```ts [routes/_ws.ts]
import { defineWebSocketHandler } from "nitro/h3";

export default defineWebSocketHandler({
  open(peer) {
    peer.send({ user: "server", message: `Welcome ${peer}!` });
    peer.publish("chat", { user: "server", message: `${peer} joined!` });
    peer.subscribe("chat");
  },
  message(peer, message) {
    if (message.text().includes("ping")) {
      peer.send({ user: "server", message: "pong" });
    } else {
      const msg = {
        user: peer.toString(),
        message: message.toString(),
      };
      peer.send(msg); // echo
      peer.publish("chat", msg);
    }
  },
  close(peer) {
    peer.publish("chat", { user: "server", message: `${peer} left!` });
  },
});
```

Different hooks are exposed by `defineWebSocketHandler()` to integrate with different parts of the websocket lifecycle.

<!-- /automd -->

## Learn More

- [Routing](/docs/routing)
- [crossws Documentation](https://crossws.h3.dev/guide/hooks)
