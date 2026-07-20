import { useStorage } from "nitro/storage";

export default () => {
  const storage = useStorage();
  return storage.get("test:key");
};
