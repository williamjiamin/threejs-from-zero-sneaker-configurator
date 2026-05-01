# Cloudflare Pages — One-Time Secrets Setup

`.github/workflows/deploy-pages.yml` is prewired but stays inert until two GitHub repository secrets exist. Once added, every push to `main` deploys `dist/` to `https://threejs-from-zero-sneaker-configurator.pages.dev` automatically.

## What you need

1. A Cloudflare API token scoped to **Cloudflare Pages — Edit**.
2. Your Cloudflare **Account ID** (visible in the right sidebar of any dashboard page).

## Step 1 — create the API token

1. Open `https://dash.cloudflare.com/profile/api-tokens`.
2. Click **Create Token**.
3. Pick the **Cloudflare Pages — Edit** template (or **Custom** with `Account → Cloudflare Pages → Edit`).
4. Scope to your account.
5. Copy the token immediately. Cloudflare only shows it once.

## Step 2 — add the secrets to the GitHub repo

In `https://github.com/williamjiamin/threejs-from-zero-sneaker-configurator`:

1. **Settings → Secrets and variables → Actions**.
2. **New repository secret** twice:
   - `CLOUDFLARE_API_TOKEN` — paste the token from Step 1.
   - `CLOUDFLARE_ACCOUNT_ID` — paste your account ID.

Done. The next push to `main` runs the deploy job.

## Verifying the wire-up

The deploy job has an `if:` guard that only runs when both secrets are present. After adding them, watch **Actions → Deploy Cloudflare Pages** on the next push. A green run there confirms the pipeline.

`wrangler pages deploy dist` from the local machine continues to work alongside the CI flow.

## Why secrets, not variables

Cloudflare API tokens grant edit access to the Pages project. Use **secrets** (encrypted at rest, masked in workflow logs). Never plain repository variables, never check the token into the repo.
