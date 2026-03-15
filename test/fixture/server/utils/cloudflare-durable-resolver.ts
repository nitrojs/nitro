import type { CloudflareDurableResolver } from "nitro/types";

const resolveInstanceName: CloudflareDurableResolver = ({ request, defaultInstanceName }) => {
  if (!request) {
    return;
  }

  const room = new URL(request.url).searchParams.get("room");
  return room || defaultInstanceName;
};

export default resolveInstanceName;
