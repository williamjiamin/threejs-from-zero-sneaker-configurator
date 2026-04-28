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
4. Optionally connect the existing GitHub repo to Cloudflare Pages for CI-driven deploys instead of manual `wrangler` publishes.

## Publish notes

- Cloudflare Pages deployment is live at `https://threejs-from-zero-sneaker-configurator.pages.dev`.
- Source control now lives at `https://github.com/williamjiamin/threejs-from-zero-sneaker-configurator`.
- `repo/dist/` stays in the tree so the static tutorial pages can keep a local fallback preview surface.
