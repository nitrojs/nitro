# EdgeOne Pages

> Deploy Nitro apps to EdgeOne Pages.

**Preset:** `edgeone_pages`

:read-more{to="https://pages.edgeone.ai/"}

## Using the control panel

1. In the [EdgeOne Pages control panel](https://console.tencentcloud.com/edgeone/pages), click **Create project**.
2. Choose **Import Git repository** as your deployment method. EdgeOne supports deployments from GitHub, GitLab, Gitee, and CNB.
3. Choose the **repository** and **branch** containing your application code.
4. During setup, add a `NITRO_PRESET` environment variable set to `edgeone_pages` (this step is required).
5. Click the **Deploy** button.

## Using the EdgeOne CLI

You can also deploy with the [EdgeOne CLI](https://pages.edgeone.ai/document/edgeone-cli) (see its docs for installation and usage).

Once configured, run `edgeone pages deploy` to deploy the project. The CLI first builds the project automatically, then uploads and publishes the build artifacts.
