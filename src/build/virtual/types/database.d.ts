import type { Connector } from "db0";

export declare const connectionConfigs: {
  [name: string]: {
    connector: (options: any) => Connector;
    options: any;
  };
};
