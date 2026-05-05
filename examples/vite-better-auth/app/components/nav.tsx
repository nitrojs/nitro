import { useSession } from "../utils/auth";

export default () => {
  const session = useSession();

  return (
    <>
      <nav className="flex justify-between items-center p-4 border-b mb-4">
        <a href="/">Home</a>
        <div>
          <a href="/auth/sign-in" className="mr-4">
            Sign In
          </a>
        </div>
      </nav>
    </>
  );
};
