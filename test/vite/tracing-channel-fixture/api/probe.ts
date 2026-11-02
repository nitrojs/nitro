export default () => ({ ...(globalThis as any).__tracingProbe?.counts });
