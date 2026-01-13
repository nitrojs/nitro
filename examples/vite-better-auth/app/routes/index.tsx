import { useSession } from "../utils/auth";

export default () => {
  const session = useSession();
  return (
    <div>
      Welcome!
      {session.isPending ? (
        <div>Loading session...</div>
      ) : (
        JSON.stringify(session.data, null, 2)
      )}
    </div>
  );
};
