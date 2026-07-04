import type { Route } from "./+types/home";
import logoDark from "../logos/logo-dark.svg";
import logoLight from "../logos/logo-light.svg";
import nitroLogo from "../logos/nitro.svg";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: "Nitro + React Router" },
    { name: "description", content: "React Router SSR powered by Nitro." },
  ];
}

export default function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center sm:py-24">
      <h1 className="flex items-center gap-5 sm:gap-8">
        <span className="sr-only">Nitro + React Router</span>
        <img className="size-16 sm:size-24" src={nitroLogo} alt="" aria-hidden />
        <span
          className="text-4xl font-light text-gray-300 sm:text-6xl dark:text-gray-600"
          aria-hidden
        >
          +
        </span>
        <picture>
          <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
          <img className="w-48 sm:w-80" src={logoLight} alt="" aria-hidden />
        </picture>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-300">
        Full-stack React Router, powered by Nitro.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
        <a
          className="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-950 hover:decoration-gray-500 dark:text-gray-300 dark:decoration-gray-700 dark:hover:text-white dark:hover:decoration-gray-500"
          href="https://nitro.build"
          target="_blank"
          rel="noreferrer"
        >
          Nitro Docs ↗
        </a>
        <a
          className="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-950 hover:decoration-gray-500 dark:text-gray-300 dark:decoration-gray-700 dark:hover:text-white dark:hover:decoration-gray-500"
          href="https://reactrouter.com/docs"
          target="_blank"
          rel="noreferrer"
        >
          React Router Docs ↗
        </a>
      </div>

      <section className="mt-16 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="font-semibold text-gray-950 dark:text-white">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              {feature.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

const features = [
  {
    title: "Portable deployments",
    description: "Use presets to build the same app for Node, workers, and serverless runtimes.",
  },
  {
    title: "Backend primitives",
    description: "Use portable caching, storage, databases, route rules, and runtime tasks.",
  },
  {
    title: "One production server",
    description: "Serve SSR, client assets, and API routes from a single production output.",
  },
  {
    title: "One Vite lifecycle",
    description: "Develop and build the React Router frontend and Nitro backend together.",
  },
  {
    title: "In-process requests",
    description: "Call Nitro routes from loaders without an origin or network round trip.",
  },
  {
    title: "Routing without glue",
    description: "Handle server routes first, then fall through to React Router SSR automatically.",
  },
];
