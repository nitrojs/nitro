import type { Features } from "@netlify/dev";

/**
 * Netlify options
 */
export interface NetlifyOptions {
  dev?: Features;

  images?: {
    /**
     * Permitted remote image sources. Array of regex strings.
     * @see https://docs.netlify.com/image-cdn/overview/#remote-path
     */
    remote_images?: string[];
  };
}
