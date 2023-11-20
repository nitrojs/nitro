import { promises as fsp } from "node:fs";
import { execaCommand } from "execa";
import { resolve } from "pathe";
import { globby } from "globby";

const nightlyPackages = {
  h3: "h3-nightly",
};

async function loadPackage(dir: string) {
  const pkgPath = resolve(dir, "package.json");
  const data = JSON.parse(
    await fsp.readFile(pkgPath, "utf8").catch(() => "{}")
  );
  const save = () =>
    fsp.writeFile(pkgPath, JSON.stringify(data, null, 2) + "\n");

  const updateDeps = (reviver: (dep: any) => any) => {
    for (const type of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      if (!data[type]) {
        continue;
      }
      for (const e of Object.entries(data[type])) {
        const dep = { name: e[0], range: e[1], type };
        delete data[type][dep.name];
        const updated = reviver(dep) || dep;
        data[updated.type] = data[updated.type] || {};
        data[updated.type][updated.name] = updated.range;
      }
    }
  };

  return {
    dir,
    data,
    save,
    updateDeps,
  };
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
type Package = ThenArg<ReturnType<typeof loadPackage>>;

async function loadWorkspace(dir: string) {
  const workspacePkg = await loadPackage(dir);
  const pkgDirs = await globby(workspacePkg.data.workspaces || [], {
    onlyDirectories: true,
  });

  const packages: Package[] = [workspacePkg];

  for (const pkgDir of pkgDirs) {
    const pkg = await loadPackage(pkgDir);
    if (!pkg.data.name) {
      continue;
    }
    packages.push(pkg);
  }

  const find = (name: string) => {
    const pkg = packages.find((pkg) => pkg.data.name === name);
    if (!pkg) {
      throw new Error("Workspace package not found: " + name);
    }
    return pkg;
  };

  const rename = (from: string, to: string) => {
    find(from).data.name = to;
    for (const pkg of packages) {
      pkg.updateDeps((dep) => {
        if (dep.name === from && !dep.range.startsWith("npm:")) {
          dep.range = "npm:" + to + "@" + dep.range;
        }
      });
    }
  };

  const setVersion = (name: string, newVersion: string) => {
    find(name).data.version = newVersion;
    for (const pkg of packages) {
      pkg.updateDeps((dep) => {
        if (dep.name === name) {
          dep.range = newVersion;
        }
      });
    }
  };

  const save = () => Promise.all(packages.map((pkg) => pkg.save()));

  return {
    dir,
    workspacePkg,
    packages,
    save,
    find,
    rename,
    setVersion,
  };
}

async function main() {
  const workspace = await loadWorkspace(process.cwd());

  const commit = await execaCommand("git rev-parse --short HEAD").then((r) =>
    r.stdout.trim()
  );
  const date = Math.round(Date.now() / (1000 * 60));

  for (const pkg of workspace.packages.filter((p) => !p.data.private)) {
    workspace.setVersion(
      pkg.data.name,
      `${pkg.data.version}-${date}.${commit}`
    );
    workspace.rename(pkg.data.name, pkg.data.name + "-nightly");
    pkg.updateDeps((dep) => {
      if (nightlyPackages[dep.name]) {
        dep.range = "npm:" + nightlyPackages[dep.name] + "@latest";
      }
    });
  }

  await workspace.save();
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
});
