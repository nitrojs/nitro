import { serverFetch } from "nitro";

export default async () => {
  const res = await serverFetch("/build/test.txt");
  return {
    status: res.status,
    body: await res.text(),
  };
};
