/**
 * Netlify options
 */
export interface NetlifyOptions {
  config?: {
    images?: {
      /**
       * Permitted remote image sources. Array of regex strings.
       * @see https://docs.netlify.com/image-cdn/overview/#remote-path
       */
      remote_images?: string[];
    };
  };
}
