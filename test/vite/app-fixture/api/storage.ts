import { useKV } from "nitro/kv";

export default () => {
  const storage = useKV();
  return storage.get("test:key");
};
