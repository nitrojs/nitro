export interface ZephyrOptions {
  /**
   * Deploy to Zephyr during `nitro build` when using the `zephyr` preset.
   *
   * Set to `false` to only generate deploy artifacts and deploy later with `nitro deploy`.
   *
   * @default true
   */
  deployOnBuild?: boolean;
}
