# Deployment Checklist

This run verifies the project locally, produces `dist/`, publishes the same build to Cloudflare Pages at `https://threejs-from-zero-sneaker-configurator.pages.dev`, and keeps source on GitHub at `https://github.com/williamjiamin/threejs-from-zero-sneaker-configurator`.

## Local verification

```sh
npm install
npm run build
```

## Current deploy path

1. Build locally with `npm run build` from `projects/sneaker-configurator/repo/`.
2. Deploy `dist/` with `wrangler pages deploy dist --project-name threejs-from-zero-sneaker-configurator --branch main`.
3. Use `https://threejs-from-zero-sneaker-configurator.pages.dev` in the project landing page and all ten article iframes.
4. GitHub Actions CI already verifies `npm ci` + `npm run build` on every push and pull request via `.github/workflows/ci.yml`.
5. Cloudflare deploy automation is prewired in `.github/workflows/deploy-pages.yml`; add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets to turn it on.

## Publish notes

- Cloudflare Pages deployment is live at `https://threejs-from-zero-sneaker-configurator.pages.dev`.
- Source control now lives at `https://github.com/williamjiamin/threejs-from-zero-sneaker-configurator`.
- GitHub Actions deploy uses `cloudflare/wrangler-action@v3`, matching Cloudflare's official guidance for Pages direct uploads.
- `repo/dist/` stays in the tree so the static tutorial pages can keep a local fallback preview surface.
