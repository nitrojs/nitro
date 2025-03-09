// Auto-generated using gen-presets script

import type { PresetOptions as AwsAmplifyOptions } from "./aws-amplify/preset";
import type { PresetOptions as AwsLambdaOptions } from "./aws-lambda/preset";
import type { PresetOptions as AzureOptions } from "./azure/preset";
import type { PresetOptions as CloudflareOptions } from "./cloudflare/preset";
import type { PresetOptions as FirebaseOptions } from "./firebase/preset";
import type { PresetOptions as NetlifyOptions } from "./netlify/preset";
import type { PresetOptions as VercelOptions } from "./vercel/preset";

export interface PresetOptions {
  awsAmplify: AwsAmplifyOptions;
  awsLambda: AwsLambdaOptions;
  azure: AzureOptions;
  cloudflare: CloudflareOptions;
  firebase: FirebaseOptions;
  netlify: NetlifyOptions;
  vercel: VercelOptions;
}

export const presetsWithConfig = ["awsAmplify","awsLambda","azure","cloudflare","firebase","netlify","vercel"] as const;

export type PresetName = "alwaysdata" | "aws-amplify" | "aws-lambda" | "azure-swa" | "base-worker" | "bun" | "cleavr" | "cloudflare-durable" | "cloudflare-module" | "cloudflare-pages" | "cloudflare-pages-static" | "deno-deploy" | "deno-server" | "digital-ocean" | "edgio" | "firebase" | "firebase-app-hosting" | "flight-control" | "genezio" | "github-pages" | "gitlab-pages" | "heroku" | "iis-handler" | "iis-node" | "koyeb" | "netlify" | "netlify-edge" | "netlify-static" | "nitro-dev" | "nitro-prerender" | "node-cluster" | "node-middleware" | "node-server" | "platform-sh" | "render-com" | "static" | "stormkit" | "vercel" | "vercel-static" | "winterjs" | "zeabur" | "zeabur-static" | "zerops" | "zerops-static";

export type PresetNameInput = "alwaysdata" | "aws-amplify" | "awsAmplify" | "aws_amplify" | "aws-lambda" | "awsLambda" | "aws_lambda" | "azure-swa" | "azureSwa" | "azure_swa" | "base-worker" | "baseWorker" | "base_worker" | "bun" | "cleavr" | "cloudflare-durable" | "cloudflareDurable" | "cloudflare_durable" | "cloudflare-module" | "cloudflareModule" | "cloudflare_module" | "cloudflare-pages" | "cloudflarePages" | "cloudflare_pages" | "cloudflare-pages-static" | "cloudflarePagesStatic" | "cloudflare_pages_static" | "deno-deploy" | "denoDeploy" | "deno_deploy" | "deno-server" | "denoServer" | "deno_server" | "digital-ocean" | "digitalOcean" | "digital_ocean" | "edgio" | "firebase" | "firebase-app-hosting" | "firebaseAppHosting" | "firebase_app_hosting" | "flight-control" | "flightControl" | "flight_control" | "genezio" | "github-pages" | "githubPages" | "github_pages" | "gitlab-pages" | "gitlabPages" | "gitlab_pages" | "heroku" | "iis-handler" | "iisHandler" | "iis_handler" | "iis-node" | "iisNode" | "iis_node" | "koyeb" | "netlify" | "netlify-edge" | "netlifyEdge" | "netlify_edge" | "netlify-static" | "netlifyStatic" | "netlify_static" | "nitro-dev" | "nitroDev" | "nitro_dev" | "nitro-prerender" | "nitroPrerender" | "nitro_prerender" | "node-cluster" | "nodeCluster" | "node_cluster" | "node-middleware" | "nodeMiddleware" | "node_middleware" | "node-server" | "nodeServer" | "node_server" | "platform-sh" | "platformSh" | "platform_sh" | "render-com" | "renderCom" | "render_com" | "static" | "stormkit" | "vercel" | "vercel-static" | "vercelStatic" | "vercel_static" | "winterjs" | "zeabur" | "zeabur-static" | "zeaburStatic" | "zeabur_static" | "zerops" | "zerops-static" | "zeropsStatic" | "zerops_static" | (string & {});
