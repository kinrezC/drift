# @delvtech/evm-client

Useful EVM client abstractions for TypeScript projects that want to remain web3
library agnostic.

## Packages

- **[@delvtech/evm-client](./packages/evm-client):** Core abstractions, utils,
  and stubs.
- **[@delvtech/evm-client-viem](./packages/evm-client-viem):** Bindings for
  [Viem](https://viem.sh/).
- **[@delvtech/evm-client-ethers](./packages/evm-client-ethers):** Bindings for
  [Ethers](https://ethers.org/).

## Creating a release

This repo uses [changesets](https://github.com/changesets/changesets) to manage
versioning and changelogs. This means you shouldn't need to manually change of
the internal package versions.

Before opening a PR, run `yarn changeset` and follow the prompts to describe the
changes you've made. This will create a changeset file that should be committed.

As changesets are committed to the `main` branch, the [changesets github
action](https://github.com/changesets/action) in the release workflow will
automatically keep track of the pending `package.json` and `CHANGELOG.md`
updates in an open PR titled `chore: version packages`.

Once this PR is merged, the release workflow will be triggered, creating new
tags and github releases, and publishing the updated packages to NPM. **These
PRs should be carefully reviewed!**
