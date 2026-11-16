# Releasing cooklang-web

This project ships a single deployable application, not a library. Releases are
cut from `main`, tagged with SemVer, and published as container images to
`ghcr.io/wolfsblu/cooklang-web`.

## Versioning policy

The app version follows [SemVer](https://semver.org/): `MAJOR.MINOR.PATCH`.

| Change                                                                                            | Bump  |
| ------------------------------------------------------------------------------------------------- | ----- |
| Fix, dependency update, documentation, internal refactor with no user-visible behaviour           | patch |
| New feature, new configuration option, backwards-compatible data change                           | minor |
| Breaking configuration/env change, route break, data-format migration, or required runtime change | major |

The version is stored in three places that must agree at release time:

- `package.json`
- `.release-please-manifest.json`
- the git tag (`v1.2.3`)

release-please updates the first two and creates the tag. The Docker workflow
also checks that the tag and `package.json` match before publishing, so a
manually created tag cannot silently disagree with the code.

### Data compatibility

The recipe directory is the user's data, and shopping lists, pantry contents,
and `aisle.conf` live in it. Treat those formats as part of the public
interface:

- A release reads data written by any previous minor of the same major.
- Migrations are additive or lazy. Never rewrite recipes as an automatic
  upgrade step.
- A format change that cannot be read by the previous release is a **major**
  change and must be called out in the GitHub Release.
- Before a major upgrade, take a backup of the recipe directory.

## How a normal release happens

1. Open a pull request against `main`. Its **squash-merge title** must follow
   [Conventional Commits](https://www.conventionalcommits.org/), because that
   title becomes the commit release-please reads:
   - `feat: …` -> minor
   - `fix: …`, `perf: …`, `deps: …` -> patch
   - `feat!: …` or a `BREAKING CHANGE:` footer -> major
   - `build:`, `refactor:` are included in the changelog; `docs:`, `style:`,
     `chore:`, `test:`, and `ci:` are hidden.
2. Once merged, the **Release Please** workflow opens a
   `chore(main): release X.Y.Z` pull request containing the version bump and
   `CHANGELOG.md` update.
3. Review that PR. Check that the version bump matches the change, and add
   upgrade/migration notes to the changelog if the release needs them.
4. Merge the release PR. release-please creates the `vX.Y.Z` tag and GitHub
   Release. The same workflow then calls the image workflow directly, so the
   image is published without needing a personal access token.
5. Deploy the pinned version and verify `/health`.

No release branches are needed. A hotfix is a normal PR to `main` that produces
a patch release. If an old major ever needs support, create a `release/1.x`
branch and a separate release-please workflow targeting it.

## Published image tags

| Tag           | Created from         | Mutable?                           |
| ------------- | -------------------- | ---------------------------------- |
| `X.Y.Z`       | release              | **No**                             |
| `X.Y`, `X`    | release              | Yes, moves within the release line |
| `latest`      | release              | Yes, moves to the newest release   |
| `main`        | every push to `main` | Yes                                |
| `main-<sha>`  | every push to `main` | No, unique to the commit           |
| `pr-<number>` | pull request build   | Not pushed to the registry         |

### Version tags are immutable

**A published `X.Y.Z` tag must never be overwritten.** Re-running a release, or
re-pushing a tag, must not replace the image that users may already be running.

- The workflow checks GHCR for `X.Y.Z` before building. If the tag exists, the
  run fails with an error instead of pushing over it.
- To fix a bad release, publish the next patch. If `1.2.3` is broken, release
  `1.2.4`; do not delete or move `v1.2.3`.
- To fix release notes, edit the GitHub Release. Do not retag it.
- If a build failed **before** anything was pushed, re-running is safe and
  expected. If it failed **after** the image was pushed (for example in the
  smoke test), the version is already published: cut a patch release.
- `X`, `X.Y`, and `latest` are convenience pointers and do move. Production
  should pin `X.Y.Z` or a digest, never one of those.

Protect release tags in GitHub under **Settings -> Rules -> Rulesets**: create a
tag ruleset targeting `v*` and restrict deletion and updates. This backs up the
workflow guard at the repository level.

## First release (bootstrap)

The repository starts at `1.0.0` so release-please has a baseline. The
`bootstrap-sha` in `release-please-config.json` points at the commit before
the release setup, so release-please ignores the setup commit as long as it
uses a non-releasing title (for example `chore: add release automation`). It
will not open a release PR until the `v1.0.0` tag exists.

1. Commit the release setup and push `main`. Stage only the release files if
   there is unrelated work in the tree:

   ```sh
   git add package.json package-lock.json .release-please-manifest.json \
     release-please-config.json CHANGELOG.md .github docs README.md \
     Dockerfile docker-compose.yml .env.example vite.config.ts \
     src/app.d.ts src/lib/server/version.ts src/routes/health/+server.ts
   git commit -m "chore: add release automation"
   git push origin main
   ```

2. Create the annotated tag on that same commit and push it:

   ```sh
   git tag -a v1.0.0 -m "1.0.0"
   git push origin v1.0.0
   ```

3. Create the GitHub Release for the tag, either in the UI or with the CLI:

   ```sh
   gh release create v1.0.0 --title "1.0.0" --notes-file CHANGELOG.md
   ```

The tag push builds and publishes the first image (`1.0.0`, `1.0`, `1`,
`latest`). Verify it:

```sh
docker pull ghcr.io/wolfsblu/cooklang-web:1.0.0
docker run --rm ghcr.io/wolfsblu/cooklang-web:1.0.0 node -e "console.log(process.env.APP_VERSION)"
```

If release-please opened an unnecessary release PR before the tag existed,
close it; the tag is the source of truth. `bootstrap-sha` is ignored after the
first release. After this, do not create release tags by hand; let
release-please do it.

## Publishing a tag manually

The Docker workflow can also be run manually, which is useful if a tag was
created outside release-please or a publish job had to be retried before the
image was pushed:

```sh
gh workflow run docker.yml \
  --ref main \
  -f version=1.2.3 \
  -f ref=v1.2.3
```

`--ref main` selects the workflow file; the `ref` input is the tag that gets
checked out and built. The run fails if `1.2.3` is already published, if
`package.json` at that ref does not say `1.2.3`, or if the checked-out commit is
not tagged `v1.2.3`.

## Deploying a release

Set the version in `.env`:

```sh
COOKLANG_WEB_VERSION=1.2.3
```

Then:

```sh
docker compose pull
docker compose up -d
```

Confirm the running image and version:

```sh
curl -fsS http://localhost:8080/health | jq
```

`/health` reports `version`, `commit`, `cookCliVersion`, and the recipe count.
To roll back, set `COOKLANG_WEB_VERSION` to the previous release and repeat the
two commands. Rolling back the app image does not roll back data migrations, so
back up the recipe directory before a major upgrade.

`latest` is fine for a test instance but is not a reproducible deployment. A
`main` image is the unstable tip and should only be used to try unreleased
changes.

## Cook CLI updates

The Cook CLI is a separate dependency, pinned by `COOK_CLI_VERSION` and
`COOK_CLI_SHA256` in the `Dockerfile`. Its version is independent of the app
version and is reported separately by `/health`.

- Bump it in its own `build:` pull request.
- Run the image smoke test before merging (CI does this for every image build).
- Treat behaviour changes as release notes under **Build System**.
- The image currently downloads the `linux-x86_64-musl` CLI archive, so
  published images are `linux/amd64` only. Multi-arch would need an archive URL
  and checksum per architecture; do not advertise `linux/arm64` until that is
  implemented.

## What CI checks

The image workflow runs, in order:

1. `npm run verify` (typecheck, lint, tests) on the checked-out ref.
2. Version resolution, the tag/`package.json` guard, and a check that the
   checked-out commit is the matching release tag.
3. The GHCR immutability check for `X.Y.Z`.
4. A container build with `APP_VERSION` and `GIT_SHA` embedded.
5. `scripts/smoke-cook.mjs` against the built image with the real Cook CLI and
   sample recipes.
6. SBOM generation and build-provenance attestation for pushed images.

Dependabot opens weekly updates for npm, GitHub Actions, and the Docker base
image. Its commit-message prefixes are configured, but a squash merge uses the
pull request title, so retitle Dependabot PRs to `deps: …` or `build: …` before
merging if you want them in the changelog. For stricter supply-chain policy,
pin actions to commit SHAs and let Dependabot move the pins.

## Release checklist

- [ ] Pull request titles are conventional; the changelog sections look right.
- [ ] The release PR has the correct SemVer bump.
- [ ] Data-format, configuration, or Cook CLI changes are noted for users.
- [ ] `npm run verify` passes; the Release Please workflow verifies `main`
      before it is allowed to tag.
- [ ] The release PR is merged and release-please created the tag and release.
- [ ] The image workflow passed the smoke test and published `X.Y.Z`.
- [ ] A pinned deployment reports the expected version and commit in `/health`.
- [ ] The previous version tag is known for rollback.
- [ ] For a major release, the recipe directory is backed up.

## Troubleshooting

**No release PR appears.** Check that merged commit titles are conventional,
that the `verify` job passed, that the workflow has `contents: write` and
`pull-requests: write`, and that **Settings -> Actions -> General -> Allow
GitHub Actions to create and approve pull requests** is enabled.

**The release PR has no CI checks.** release-please uses `GITHUB_TOKEN`, and
resources created with it do not trigger other workflows. The Release Please
workflow verifies the merge commit before tagging it, and the publish job runs
`npm run verify` again before building, so the release is still checked. If you
need checks on the release PR itself, give release-please a PAT, but then
remove the `tags:` trigger from `docker.yml`: the release workflow already
calls the image build directly, and the duplicate tag push would hit the
immutability guard.

**`Version X does not match package.json`.** The tag and the code disagree. Do
not move an existing tag. For a not-yet-published release, fix `package.json`
and the manifest in a new PR and retag only if the old tag was never published
and never used.

**`… already exists. Published version tags are immutable`.** The version is
already in GHCR. Cut a new patch release instead of retrying the old one.

**`latest` did not move.** Only release builds move `latest`; pushes to `main`
publish `main` and `main-<sha>`.

**Cannot pull from GHCR.** Authenticate with a token that has `read:packages`:

```sh
echo "$GITHUB_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin
```
