/**
 * Netlify options
 */
export interface NetlifyOptions {
  /** @deprecated Use `config.images` */
  images?: NetlifyImageOptions;
  config?: {
    images?: NetlifyImageOptions;
  };
}

interface NetlifyImageOptions {
  /**
   * Permitted remote image sources. Array of regex strings.
   * @see https://docs.netlify.com/image-cdn/overview/#remote-path
   */
  remote_images?: string[];
}
