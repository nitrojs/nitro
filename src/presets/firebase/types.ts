import type { OutputBundleConfig } from "@apphosting/common";

export type AppHostingOutputBundleConfig = OutputBundleConfig;

export interface FirebaseOptions {
  appHosting: Partial<AppHostingOutputBundleConfig["runConfig"]>;
}
