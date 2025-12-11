import type { Connector } from "db0";

export const connectionConfigs: {
  [name: string]: {
    connector: (options: any) => Connector;
    options: any;
  };
} = {};
