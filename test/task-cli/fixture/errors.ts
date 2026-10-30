export function fixtureError(label: string) {
  const bytes = Number(process.env.TASK_CLI_ERROR_BYTES || 0);
  return new Error(bytes > 0 ? `${label}:${"E".repeat(bytes)}:end` : label);
}
