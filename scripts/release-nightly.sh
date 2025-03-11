#!/bin/bash

# Temporary forked from nuxt/nuxt

set -xe

# Restore all git changes
git restore -s@ -SW  -- .

# Bump according to changelog
pnpm changelogen --bump

# Bump versions to nightly
pnpm jiti ./scripts/bump-nightly

# Build mirror
pnpm gen-mirror

# Resolve lockfile
# pnpm install

# Update token
if [[ ! -z ${NODE_AUTH_TOKEN} ]] ; then
  echo "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}" >> ~/.npmrc
  echo "registry=https://registry.npmjs.org/" >> ~/.npmrc
  echo "always-auth=true" >> ~/.npmrc
  echo "npmAuthToken: ${NODE_AUTH_TOKEN}" >> ~/.npmrc.yml
  npm whoami
fi

# Release packages

# nitro-nightly@latest => v3
npm publish --access public --tolerate-republish --tag latest

# nitropack-nightly@3x => v3-mirror
cd .mirror
npm publish --access public --tolerate-republish --tag 3x
