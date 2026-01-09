# EdgeOne

> Deploy Nitro apps to EdgeOne.

**Preset:** `edgeone-pages`

:read-more{to="https://pages.edgeone.ai/"}


## Using the control panel

1. In the [EdgeOne pages control panel](https://console.tencentcloud.com/edgeone/pages), click **Create project**.
2. Choose **Import Git repository** as your deployment method. We support deployment on GitHub, GitLab, Gitee, and CNB.
3. Choose the GitHub **repository** and **branch** containing your application code.
4. Complete your project setup.
5. Click the **Deploy** button.

## Using the EdgeOne CLI

You can also install the Pages scaffolding tool. For detailed installation and usage, refer to [EdgeOne CLI](https://pages.edgeone.ai/document/edgeone-cli). 

Once configured, use the edgeone pages deploy command to deploy the project. During deployment, the CLI will first automatically build the project, then upload and publish the build artifacts.
