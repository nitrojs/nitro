# GitLab Pages

> Deploy Nitro apps to GitLab Pages.

**Preset:** `gitlab_pages`

:read-more{title="GitLab Pages" to="https://docs.gitlab.com/ee/user/project/pages/"}

## Setup

Follow the steps to [create a GitLab Pages site](https://docs.gitlab.com/ee/user/project/pages/#getting-started).

## Deployment

Here is an example GitLab CI/CD configuration to deploy your site to GitLab Pages:

```yaml [.gitlab-ci.yml]
image: node:lts
before_script:
  - npx nypm install
pages:
  cache:
    paths:
      - node_modules/
  variables:
    NITRO_PRESET: gitlab_pages
  script:
    - npm run build
  artifacts:
    paths:
      - .output/public
  publish: .output/public
  rules:
    # This ensures that only pushes to the default branch
    # will trigger a pages deploy
    - if: $CI_COMMIT_REF_NAME == $CI_DEFAULT_BRANCH
```
