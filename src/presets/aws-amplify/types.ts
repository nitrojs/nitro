export interface AmplifyComputeConfig {
  /**
   * The name property dictates the name of the provisioned compute resource. It is also the name
   * of the sub-directory in the `compute` folder in the deployment bundle.
   */
  name: string;
  /**
   * The runtime property dictates the runtime of the provisioned compute resource.
   * Values are subset of https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
   */
  runtime: "nodejs20.x" | "nodejs22.x";

  /**
   * Specifies the starting file from which code will run for the given compute resource.
   * The specified file should exist inside the given sub-directory that represents a compute resource.
   *
   * @example `"entrypoint.js"`
   */
  entrypoint: string;
}

export type AmplifyRouteTarget =
  | { kind: "Static"; cacheControl?: string }
  | { kind: "ImageOptimization"; cacheControl?: string }
  | {
      kind: "Compute";
      /**
       * A string that indicates the name of the sub-directory in the given deployment bundle that
       * contains the primitive's executable code. Valid and required only for the Compute primitive.
       * The value here should point to one of the compute resources present in the given
       * deployment bundle. The only supported value for this field is default.
       */
      src: string;
    };

export type AmplifyRoute = {
  /**
   * The path defines a glob pattern that matches incoming request paths (excluding querystring).
   * The first match in a given list of rules determines which routing rule is applied to the incoming request.
   * Only the following wildcard characters are supported as far as pattern matching is concerned: `*` (matches 0 or more characters)
   *
   * _Note_: The "/*" pattern is called a catch-all pattern and will match all incoming requests.
   * It is special because fallback routing is only supported for catch-all routes.
   *
   */
  path: string;

  /**
   * An object that dictates the target to route the matched request to.
   */
  target: AmplifyRouteTarget;

  /** An object that dictates the target to fallback to if the original target returns a 404. */
  fallback?: AmplifyRouteTarget;
};

export type AmplifyImageSettings = {
  /** Array of supported image widths */
  sizes: number[];

  /**
   * Array of allowed external domains that can use Image Optimization.
   * Leave empty for only allowing the deployment domain to use Image Optimization.
   */
  domains: string[];

  /**
   * Array of allowed external patterns that can use Image Optimization.
   * Similar to `domains` but provides more control with RegExp.
   */
  remotePatterns: {
    /** The protocol of the allowed remote pattern. Can be `http` or `https`. */
    protocol?: "http" | "https";
    /**
     * The hostname of the allowed remote pattern.
     * Can be literal or wildcard. Single `*` matches a single subdomain.
     *  Double `**` matches any number of subdomains.
     * We will disallow blanket wildcards of `**` with nothing else.
     */
    hostname: string;
    /** The port of the allowed remote pattern. */
    port?: string;
    /** The pathname of the allowed remote pattern. */
    pathname?: string;
  }[];

  /** Array of allowed output image formats. */
  formats: ("image/avif" | "image/webp" | "image/gif" | "image/png" | "image/jpeg")[];

  /** Cache duration (in seconds) for the optimized images. */
  minimumCacheTTL: number;

  /** Allow SVG input image URLs. This is disabled by default for security purposes. */
  dangerouslyAllowSVG: boolean;
};

export interface AmplifyDeployManifest {
  /** The `version` property dictates the version of the Deployment Specification that has been implemented */
  version: 1;

  /**
   * The routes property allows framework authors to leverage the routing rules primitive.
   * Routing rules provide a mechanism by which incoming request paths can be routed to a specific target
   * in the deployment bundle. Routing rules only dictate the destination of an incoming request and they are
   * applied after rewrite/redirect rules have already transformed the request.
   *
   * Limits for routing rules:
   * - A limit of 25 rules will be enforced on the routes array
   */
  routes?: AmplifyRoute[];

  /**
   * The imageSettings property allows framework authors to customize the behavior of the image optimization primitive,
   * which provides on-demand optimization of images at runtime.
   */
  imageSettings?: AmplifyImageSettings;
  /**
   * Metadata about the provisioned compute resource(s). Each item in the array is an object that contains metadata
   * about that compute resource.
   *
   * For example, given the following directory structure:
   * ```
   * .amplify
   * └── compute
   *     └── default
   *         └── index.js
   * ```
   * The `computeResources` property would look like:
   * ```
   * [
   *   {
   *     name: 'default',
   *     runtime: 'nodejs16.x',
   *     entrypoint: 'index.js',
   *   }
   * ]
   * ```
   */
  computeResources?: AmplifyComputeConfig[];

  // Framework Metadata
  framework: {
    name: string;
    version: string;
  };
}

export interface AWSAmplifyOptions {
  catchAllStaticFallback?: boolean;
  imageOptimization?: {
    path?: string;
    cacheControl?: string;
  };
  imageSettings?: AmplifyImageSettings;
  runtime?: "nodejs20.x" | "nodejs22.x";
}
