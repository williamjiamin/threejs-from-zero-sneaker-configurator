# Sneaker Configurator (Project Tutorial P1)

This repo backs the Phase 2 project tutorial **Build a Sneaker Configurator from Scratch**.

**Live demo:** https://threejs-from-zero-sneaker-configurator.pages.dev
**GitHub repo:** https://github.com/williamjiamin/threejs-from-zero-sneaker-configurator

## What this contains

- A buildable Vite app under `src/`
- A production build in `dist/` after `npm run build`
- Stage previews wired by `?stage=1..10` so each article can embed a specific checkpoint
- A custom in-repo hero sneaker asset so the repo runs immediately

## Run locally

```sh
npm install
npm run dev
```

## Build locally

```sh
npm run build
```

## Automation

- GitHub Actions CI runs on pushes, pull requests, and manual dispatch via `.github/workflows/ci.yml`.
- Cloudflare Pages deploy automation is prewired in `.github/workflows/deploy-pages.yml` and becomes active once `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are added as repository secrets.

## Checkpoints

- `p1-01` — Project Setup + Sneaker Asset Scaffold
- `p1-02` — Material Atlas + Variant Binding
- `p1-03` — Per-Part Swap — Laces, Outsole, Upper, Silhouette
- `p1-04` — Anisotropic Suede + Mesh Fabric Shaders
- `p1-05` — Decal Layer — Graphics, Monograms, Tongue Branding
- `p1-06` — Mobile Performance — fitting the GPU budget
- `p1-07` — URL Share State + Analytics Events
- `p1-08` — AR Quick Look + Scene Viewer + WebXR Routing
- `p1-09` — Photo Mode + Screenshot Generation
- `p1-10` — Deploy + Shopify Product Page Integration

## Important note

The current build ships with a custom in-repo hero sneaker asset. Swap to brand-specific SKU geometry only when exact merchandising fidelity matters.

## Related docs

- [`BUNDLE.md`](./BUNDLE.md)
- [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- [`../index.html`](../index.html)
