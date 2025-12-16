// Auto-generated using gen-presets script

import type { PresetOptions as AwsAmplifyOptions } from "./aws-amplify/preset";
import type { PresetOptions as AwsLambdaOptions } from "./aws-lambda/preset";
import type { PresetOptions as AzureOptions } from "./azure/preset";
import type { PresetOptions as CloudflareOptions } from "./cloudflare/preset";
import type { PresetOptions as FirebaseOptions } from "./firebase/preset";
import type { PresetOptions as NetlifyOptions } from "./netlify/preset";
import type { PresetOptions as VercelOptions } from "./vercel/preset";

export interface PresetOptions {
  awsAmplify?: AwsAmplifyOptions;
  awsLambda?: AwsLambdaOptions;
  azure?: AzureOptions;
  cloudflare?: CloudflareOptions;
  firebase?: FirebaseOptions;
  netlify?: NetlifyOptions;
  vercel?: VercelOptions;
}

export const presetsWithConfig = ["awsAmplify","awsLambda","azure","cloudflare","firebase","netlify","vercel"] as const;

export type PresetName = "alwaysdata" | "aws-amplify" | "aws-lambda" | "azure" | "azure-functions" | "azure-swa" | "base-worker" | "bun" | "cleavr" | "cli" | "cloudflare" | "cloudflare-dev" | "cloudflare-durable" | "cloudflare-module" | "cloudflare-module-legacy" | "cloudflare-pages" | "cloudflare-pages-static" | "cloudflare-worker" | "deno" | "deno-deploy" | "deno-server" | "deno-server-legacy" | "digital-ocean" | "edgio" | "firebase" | "firebase-app-hosting" | "flight-control" | "genezio" | "github-pages" | "gitlab-pages" | "heroku" | "iis" | "iis-handler" | "iis-node" | "koyeb" | "layer0" | "netlify" | "netlify-builder" | "netlify-edge" | "netlify-legacy" | "netlify-static" | "nitro-dev" | "nitro-prerender" | "node" | "node-cluster" | "node-listener" | "node-server" | "platform-sh" | "render-com" | "service-worker" | "static" | "stormkit" | "vercel" | "vercel-edge" | "vercel-static" | "winterjs" | "zeabur" | "zeabur-static" | "zerops" | "zerops-static";

export type PresetNameInput = "alwaysdata" | "aws-amplify" | "awsAmplify" | "aws_amplify" | "aws-lambda" | "awsLambda" | "aws_lambda" | "azure" | "azure-functions" | "azureFunctions" | "azure_functions" | "azure-swa" | "azureSwa" | "azure_swa" | "base-worker" | "baseWorker" | "base_worker" | "bun" | "cleavr" | "cli" | "cloudflare" | "cloudflare-dev" | "cloudflareDev" | "cloudflare_dev" | "cloudflare-durable" | "cloudflareDurable" | "cloudflare_durable" | "cloudflare-module" | "cloudflareModule" | "cloudflare_module" | "cloudflare-module-legacy" | "cloudflareModuleLegacy" | "cloudflare_module_legacy" | "cloudflare-pages" | "cloudflarePages" | "cloudflare_pages" | "cloudflare-pages-static" | "cloudflarePagesStatic" | "cloudflare_pages_static" | "cloudflare-worker" | "cloudflareWorker" | "cloudflare_worker" | "deno" | "deno-deploy" | "denoDeploy" | "deno_deploy" | "deno-server" | "denoServer" | "deno_server" | "deno-server-legacy" | "denoServerLegacy" | "deno_server_legacy" | "digital-ocean" | "digitalOcean" | "digital_ocean" | "edgio" | "firebase" | "firebase-app-hosting" | "firebaseAppHosting" | "firebase_app_hosting" | "flight-control" | "flightControl" | "flight_control" | "genezio" | "github-pages" | "githubPages" | "github_pages" | "gitlab-pages" | "gitlabPages" | "gitlab_pages" | "heroku" | "iis" | "iis-handler" | "iisHandler" | "iis_handler" | "iis-node" | "iisNode" | "iis_node" | "koyeb" | "layer0" | "netlify" | "netlify-builder" | "netlifyBuilder" | "netlify_builder" | "netlify-edge" | "netlifyEdge" | "netlify_edge" | "netlify-legacy" | "netlifyLegacy" | "netlify_legacy" | "netlify-static" | "netlifyStatic" | "netlify_static" | "nitro-dev" | "nitroDev" | "nitro_dev" | "nitro-prerender" | "nitroPrerender" | "nitro_prerender" | "node" | "node-cluster" | "nodeCluster" | "node_cluster" | "node-listener" | "nodeListener" | "node_listener" | "node-server" | "nodeServer" | "node_server" | "platform-sh" | "platformSh" | "platform_sh" | "render-com" | "renderCom" | "render_com" | "service-worker" | "serviceWorker" | "service_worker" | "static" | "stormkit" | "vercel" | "vercel-edge" | "vercelEdge" | "vercel_edge" | "vercel-static" | "vercelStatic" | "vercel_static" | "winterjs" | "zeabur" | "zeabur-static" | "zeaburStatic" | "zeabur_static" | "zerops" | "zerops-static" | "zeropsStatic" | "zerops_static" | (string & {});
