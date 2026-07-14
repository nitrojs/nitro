# Azure

> Deploy Nitro apps to Azure Static Web Apps.

## Azure Static Web Apps

**Preset:** `azure_swa`

:read-more{title="Azure Static Web Apps" to="https://azure.microsoft.com/en-us/products/app-service/static"}

::note
Integration with this provider is possible with [zero configuration](/deploy/#zero-config-providers).
::

[Azure Static Web Apps](https://azure.microsoft.com/en-us/products/app-service/static) are designed to be deployed continuously in a [GitHub Actions workflow](https://docs.microsoft.com/en-us/azure/static-web-apps/github-actions-workflow). Nitro detects this deployment environment and enables the `azure_swa` preset automatically.

### Local preview

To test locally, install [Azure Functions Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local), then build and start a local preview environment:

```bash
NITRO_PRESET=azure_swa npm run build
npx @azure/static-web-apps-cli start .output/public --api-location .output/server
```

### Configuration

Azure Static Web Apps are [configured](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration) using the `staticwebapp.config.json` file.

Nitro automatically generates this configuration file whenever the application is built with the `azure_swa` preset.

Nitro sets the following properties automatically:

| Property | Criteria | Default |
| --- | --- | --- |
| **[platform.apiRuntime](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration#platform)** | Set to `node:20` or `node:22` based on the `engines.node` field in your `package.json`. | `node:20` |
| **[navigationFallback.rewrite](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration#fallback-routes)** | Always `/api/server` | `/api/server` |
| **[routes](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration#routes)** | All prerendered routes are added. Additionally, if you do not have an `index.html` file, an empty one is created for compatibility purposes, and requests to `/index.html` are redirected to the root directory (handled by `/api/server`). | `[]` |

### Custom configuration

You can alter the Nitro-generated configuration using the `azure.config` option.

Custom routes are added and matched first. In case of a conflict (two objects with the same route property), custom routes override generated ones.

### Deploy from CI/CD via GitHub Actions

When you link your GitHub repository to Azure Static Web Apps, a workflow file is added to the repository.

When you are asked to select your framework, select custom and provide the following information:

| Input | Value |
| --- | --- |
| **app_location** | '/' |
| **api_location** | '.output/server' |
| **output_location** | '.output/public' |

If you miss this step, you can always find the build configuration section in your workflow and update the build configuration:

```yaml [.github/workflows/azure-static-web-apps-<RANDOM_NAME>.yml]
###### Repository/Build Configurations ######
app_location: '/'
api_location: '.output/server'
output_location: '.output/public'
###### End of Repository/Build Configurations ######
```

That's it! Now Azure Static Web Apps will automatically deploy your Nitro-powered application on push.

If you are using `runtimeConfig`, you will likely want to configure the corresponding [environment variables on Azure](https://docs.microsoft.com/en-us/azure/static-web-apps/application-settings).

