# Koyeb

> Deploy Nitro apps to Koyeb.

**Preset:** `koyeb`

:read-more{to="https://www.koyeb.com"}

## Using the control panel

1. In the [Koyeb control panel](https://app.koyeb.com/), click **Create App**.
2. Choose **GitHub** as your deployment method.
3. Choose the GitHub **repository** and **branch** containing your application code.
4. Name your Service.
5. If you did not add a `start` command to your `package.json` file, under the **Build and deployment settings**, toggle the override switch associated with the run command field. In the **Run command** field, enter:

   ```bash
   node .output/server/index.mjs
   ```

6. In the **Advanced** section, click **Add Variable** and add a `NITRO_PRESET` variable set to `koyeb`.
7. Name the App.
8. Click the **Deploy** button.

## Using the Koyeb CLI

1. Follow the instructions for your operating system to [install the Koyeb CLI client](https://www.koyeb.com/docs/cli/installation), or download it directly from the [releases page on GitHub](https://github.com/koyeb/koyeb-cli/releases).
2. Create a Koyeb API access token by visiting the [API settings for your organization](https://app.koyeb.com/settings/api) in the Koyeb control panel.
3. Log into your account with the Koyeb CLI by typing:

   ```bash
   koyeb login
   ```

   Paste your API credentials when prompted.
4. Deploy your Nitro application from a GitHub repository with the following command. Be sure to substitute your own values for `<APPLICATION_NAME>`, `<YOUR_GITHUB_USERNAME>`, and `<YOUR_REPOSITORY_NAME>`:

   ```bash
   koyeb app init <APPLICATION_NAME> \
      --git github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME> \
      --git-branch main \
      --git-run-command "node .output/server/index.mjs" \
      --ports 3000:http \
      --routes /:3000 \
      --env PORT=3000 \
      --env NITRO_PRESET=koyeb
   ```

## Using a docker container

1. Create a `.dockerignore` file in the root of your project and add the following lines:

   ```
   Dockerfile
   .dockerignore
   node_modules
   npm-debug.log
   .nitro
   .output
   .git
   dist
   README.md
   ```

2. Add a `Dockerfile` to the root of your project:

   ```
   FROM node:20-alpine AS base

   FROM base AS deps
   RUN apk add --no-cache libc6-compat
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci

   FROM base AS builder
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build && npm cache clean --force

   FROM base AS runner
   WORKDIR /app
   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 nitro
   COPY --from=builder /app .
   USER nitro
   EXPOSE 3000
   ENV PORT 3000
   CMD ["npm", "run", "start"]
   ```

The Dockerfile above provides the minimum requirements to run the Nitro application. You can easily extend it depending on your needs.

Next, push your Docker image to a registry, for example [Docker Hub](https://hub.docker.com/) or [GitHub Container Registry](https://docs.github.com/en/packages/guides/about-github-container-registry).

In the Koyeb control panel, use the image and tag fields to specify the image you want to deploy. You can also use the [Koyeb CLI](https://www.koyeb.com/docs/build-and-deploy/cli/installation). Refer to the Koyeb [Docker documentation](https://www.koyeb.com/docs/build-and-deploy/prebuilt-docker-images) for more information.
