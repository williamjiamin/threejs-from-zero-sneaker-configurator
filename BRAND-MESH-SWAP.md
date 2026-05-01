# Brand-Specific SKU Mesh Swap

The current build ships a custom in-repo hero sneaker. That keeps the project runnable without third-party licensing and zero external asset dependencies. When a merch client needs exact merchandising fidelity, swap the geometry without touching the rest of the stack.

## What stays the same

- The state shape: `upper`, `accent`, `outsole`, `laces`, `silhouette`, `material`, `decal`, `lowPower`, `autoRotate`.
- The variant binding contract (named material slots → swatches → events).
- Stage routing via `?stage=1..10`.
- Photo mode, share state, AR routing hooks, analytics events, Shopify embed snippet.

## What changes

Only the geometry source. Replace `buildShoe(materials)` in `src/main.js` with a `GLTFLoader` path plus a small adapter that:

1. Maps the brand glTF's part meshes back to atlas slots.
2. Hands those meshes to the same material-application path the in-repo build uses.
3. Keeps anchor positions roughly compatible so the camera framing still reads.

## Suggested adapter

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
loader.setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer));

const NAME_TO_SLOT = {
  Upper: 'upper', Toecap: 'upper', Heel: 'upper',
  Logo: 'accent', Swoosh: 'accent', Stripe: 'accent',
  Outsole: 'outsole', Sole: 'outsole', Midsole: 'outsole',
  Laces: 'laces', Lace: 'laces',
};

async function loadBrandSneaker(url, materials) {
  const gltf = await loader.loadAsync(url);
  const slots = { upper: null, accent: null, outsole: null, laces: null };
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    const slot = NAME_TO_SLOT[node.name];
    if (slot && !slots[slot]) {
      node.material = materials[slot];
      node.castShadow = true;
      node.receiveShadow = true;
      slots[slot] = node;
    }
  });
  return { group: gltf.scene, parts: slots };
}
```

Then replace `const shoe = buildShoe(materials);` with `const shoe = await loadBrandSneaker(brandUrl, materials);` and re-fit the camera to the new bounding box.

## Asset hygiene

- Run brand glTFs through `gltf-transform` or `gltfpack` first — Draco geometry, KTX2 textures, meshopt for transforms.
- Put licensed assets behind a signed URL or short-lived bucket policy. Never commit them to the public repo.
- Keep the in-repo hero sneaker as a local-dev fallback so the build still runs without the licensed asset.

## When this is worth doing

- A real merchandising client needs SKU-accurate previews.
- Marketing wants brand-correct screenshots from photo mode.
- AR Quick Look has to match the brand's existing USDZ catalog.

When none of those apply, the in-repo hero is the right answer — no licensing risk, no asset pipeline, no broken local dev.
