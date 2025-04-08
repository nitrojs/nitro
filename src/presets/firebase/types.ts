export interface FirebaseOptions {
  appHosting: Partial<AppHostingOutputBundleConfig["runConfig"]>;
}

// Source: https://github.com/FirebaseExtended/firebase-framework-tools/blob/main/packages/%40apphosting/common/src/index.ts
export interface AppHostingOutputBundleConfig {
  version: "v1";

  // Fields needed to configure the App Hosting server
  runConfig: {
    /** Command to start the server (e.g. "node dist/index.js"). Assume this command is run from the root dir of the workspace. */
    runCommand: string;
    /** Environment variables set when the app is run. */
    environmentVariables?: Array<{
      /** Name of the variable. */
      variable: string;
      /** Value associated with the variable. */
      value: string;
      /** Where the variable will be available, for now only RUNTIME is supported. */
      availability: "RUNTIME"[];
    }>;
    // See https://firebase.google.com/docs/reference/apphosting/rest/v1beta/projects.locations.backends.builds#runconfig for documentation on the next fields
    /** The maximum number of concurrent requests that each server instance can receive. */
    concurrency?: number;
    /** The number of CPUs used in a single server instance. */
    cpu?: number;
    /** The amount of memory available for a server instance. */
    memoryMiB?: number;
    /** The limit on the minimum number of function instances that may coexist at a given time. */
    minInstances?: number;
    /** The limit on the maximum number of function instances that may coexist at a given time. */
    maxInstances?: number;
  };

  // Additional fields needed for identifying the framework and adapter being used
  metadata: {
    // Name of the adapter (this should be the official package name) e.g. "@apphosting/adapter-nextjs"
    adapterPackageName: string;
    // Version of the adapter, e.g. "18.0.1"
    adapterVersion: string;
    // Name of the framework that is being supported, e.g. "angular"
    framework: string;
    // Version of the framework that is being supported, e.g. "18.0.1"
    frameworkVersion?: string;
  };

  // Optional outputFiles for frameworks to optimize server files + static assets.
  outputFiles?: {
    /** serverApp holds a list of directories + files relative to the app root dir that frameworks need to deploy to the App Hosting server. */
    serverApp: {
      include: string[];
    };
  };
}
