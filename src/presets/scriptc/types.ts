export interface ScriptcOptions {
  /**
   * Compile the server into a native executable (`server/index`) after the build.
   *
   * `scriptc` is resolved from the `SCRIPTC` environment variable, the project's
   * `scriptc` package or `PATH`. When it is not found, the build only warns.
   *
   * @default true
   */
  compile?: boolean;

  /**
   * Additional arguments for `scriptc build` (e.g. `["--strip"]`).
   */
  args?: string[];
}
