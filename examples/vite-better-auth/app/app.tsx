import React from "react";
import "./styles.css";

import { Route, Switch } from "wouter";
import { LoadingSkeleton } from "./components/loading";

const Homepage = React.lazy(() => import("./routes/index"));
const AuthSignIn = React.lazy(() => import("./routes/auth/sign-in"));
const AuthSignUp = React.lazy(() => import("./routes/auth/sign-up"));

export const App = () => {
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
      <React.Suspense fallback={<LoadingSkeleton />}>
        <div className="flex justify-center items-center min-h-[60vh] w-full">
          <Switch>
            <Route path="/" component={Homepage} />
            <Route path="/auth/sign-in" component={AuthSignIn} />
            <Route path="/auth/sign-up" component={AuthSignUp} />
          </Switch>
        </div>
      </React.Suspense>
    </>
  );
};
