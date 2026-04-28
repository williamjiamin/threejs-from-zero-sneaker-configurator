# Deployment Checklist

This run verifies the project locally, produces `dist/`, and publishes the same build to Cloudflare Pages at `https://threejs-from-zero-sneaker-configurator.pages.dev`.

## Local verification

```sh
npm install
npm run build
```

## Current deploy path

1. Build locally with `npm run build` from `projects/sneaker-configurator/repo/`.
2. Deploy `dist/` with `wrangler pages deploy dist --project-name threejs-from-zero-sneaker-configurator --branch main`.
3. Use `https://threejs-from-zero-sneaker-configurator.pages.dev` in the project landing page and all ten article iframes.
4. Optionally connect the repo to GitHub-backed CI once the standalone repository is published.

## Publish notes

- Cloudflare Pages deployment is live at `https://threejs-from-zero-sneaker-configurator.pages.dev`.
- `repo/dist/` stays in the tree so the static tutorial pages can keep a local fallback preview surface.
