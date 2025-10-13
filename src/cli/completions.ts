import type { ArgsDef, CommandDef } from "citty";
import tab from "@bomb.sh/tab/citty";

export async function initCompletions<T extends ArgsDef = ArgsDef>(
    command: CommandDef<T>
) {
    const completion = await tab(command);

    const devCommand = completion.commands.get("dev");
    if (devCommand) {
        const portOption = devCommand.options.get("port");
        if (portOption) {
            portOption.handler = (complete) => {
                complete("3000", "Default development port");
                complete("3001", "Alternative port");
                complete("8080", "Common alternative port");
                complete("4000", "Another common port");
            };
        }

        const hostOption = devCommand.options.get("host");
        if (hostOption) {
            hostOption.handler = (complete) => {
                complete("localhost", "Local development");
                complete("0.0.0.0", "Listen on all interfaces");
                complete("127.0.0.1", "Loopback address");
            };
        }

        const dirOption = devCommand.options.get("dir");
        if (dirOption) {
            dirOption.handler = (complete) => {
                complete(".", "Current directory");
            };
        }
    }

    const buildCommand = completion.commands.get("build");
    if (buildCommand) {
        const presetOption = buildCommand.options.get("preset");
        if (presetOption) {
            presetOption.handler = (complete) => {
                complete("node-server", "Node.js server");
                complete("node-middleware", "Node.js middleware");
                complete("node-cluster", "Node.js cluster mode");

                // Static presets
                complete("static", "Static hosting");
                complete("github-pages", "GitHub Pages");
                complete("gitlab-pages", "GitLab Pages");

                complete("cloudflare-pages", "Cloudflare Pages");
                complete("cloudflare-pages-static", "Cloudflare Pages (static)");
                complete("cloudflare-module", "Cloudflare Workers (module)");
                complete("cloudflare-durable", "Cloudflare Durable Objects");
                complete("vercel", "Vercel");
                complete("vercel-static", "Vercel (static)");
                complete("netlify", "Netlify");
                complete("netlify-edge", "Netlify Edge Functions");
                complete("netlify-static", "Netlify (static)");

                complete("aws-lambda", "AWS Lambda");
                complete("aws-amplify", "AWS Amplify");

                complete("azure-swa", "Azure Static Web Apps");

                complete("firebase-app-hosting", "Firebase App Hosting");
                complete("deno-deploy", "Deno Deploy");
                complete("deno-server", "Deno Server");
                complete("bun", "Bun runtime");
                complete("digital-ocean", "DigitalOcean");
                complete("heroku", "Heroku");
                complete("render-com", "Render.com");
                complete("zeabur", "Zeabur");
                complete("zeabur-static", "Zeabur (static)");
                complete("zerops", "Zerops");
                complete("zerops-static", "Zerops (static)");
                complete("koyeb", "Koyeb");
                complete("platform-sh", "Platform.sh");
                complete("flight-control", "FlightControl");
                complete("cleavr", "Cleavr");
                complete("stormkit", "Stormkit");
                complete("genezio", "Genezio");
                complete("alwaysdata", "AlwaysData");

                complete("iis-handler", "IIS Handler");
                complete("iis-node", "IIS Node");
                complete("winterjs", "WinterJS");
                complete("standard", "Standard runtime");
            };
        }

        const minifyOption = buildCommand.options.get("minify");
        if (minifyOption) {
            minifyOption.handler = (complete) => {
                complete("true", "Enable minification");
                complete("false", "Disable minification");
            };
        }

        const dirOption = buildCommand.options.get("dir");
        if (dirOption) {
            dirOption.handler = (complete) => {
                complete(".", "Current directory");
            };
        }
    }

    const prepareCommand = completion.commands.get("prepare");
    if (prepareCommand) {
        const dirOption = prepareCommand.options.get("dir");
        if (dirOption) {
            dirOption.handler = (complete) => {
                complete(".", "Current directory");
            };
        }
    }

    const taskListCommand = completion.commands.get("task list");
    if (taskListCommand) {
        const dirOption = taskListCommand.options.get("dir");
        if (dirOption) {
            dirOption.handler = (complete: (value: string, description: string) => void) => {
                complete(".", "Current directory");
            };
        }
    }

    const taskRunCommand = completion.commands.get("task run");
    if (taskRunCommand) {
        const dirOption = taskRunCommand.options.get("dir");
        if (dirOption) {
            dirOption.handler = (complete: (value: string, description: string) => void) => {
                complete(".", "Current directory");
            };
        }

        const payloadOption = taskRunCommand.options.get("payload");
        if (payloadOption) {
            payloadOption.handler = (complete: (value: string, description: string) => void) => {
                complete("{}", "");
            };
        }
    }

    return completion;
}

