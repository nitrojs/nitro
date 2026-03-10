import type { HTTPError } from "h3";

export interface PrerenderRoute {
  route: string;
  contents?: string;
  data?: ArrayBuffer;
  fileName?: string;
  error?: Partial<HTTPError>;
  generateTimeMS?: number;
  skip?: boolean;
  contentType?: string;
}

/** @deprecated Internal type will be removed in future versions */
export type PrerenderGenerateRoute = PrerenderRoute;
