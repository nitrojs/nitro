export interface AzureOptions {
  /**
   * Azure Functions Node.js programming model of the generated server function.
   *
   * - `4` (default): Registers the function with `app.http()` from `@azure/functions` (must be installed in your project).
   * - `3`: Legacy model using a `function.json` file.
   *
   * @see https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node
   */
  functionsVersion?: 3 | 4;
  config?: {
    platform?: {
      apiRuntime?: string;
      [key: string]: unknown;
    };
    navigationFallback?: {
      rewrite?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}
