# Wardrobe Web Viewer 01 (private local draft)

A static TypeScript/Vite sidecar that reads one game-owned garment catalog, individual
`garment_def` JSON files, and GLB models. It includes a two-garment, six-colorway
synthetic preview. No remote requests, purchases, telemetry, publication, or deployment
are implemented. All geometry and sample presets were created specifically for this draft.

## Commands

From this directory in the **returned archive**:

```sh
npm install
npm run test
npm run test:native
npm run test:fixtures
npm run typecheck
npm run build
npm run preview
```

Open the preview URL printed locally by the command. Because the app fetches JSON and
GLB by path, use the local preview server instead of opening `dist/index.html`
directly with a file URL. The static build produces a `dist/` directory that you can
inspect locally. Do not publish it without separate authorization.

The build-time `scripts/stage-game-assets.mjs` reads the canonical game asset root
and places only referenced JSON/GLB files in ignored `public/game/`, from which Vite
makes its usual static output. Sample content defaults to the sibling archive folder
`../../../game_module/` relative to `scripts/`. For a separate source checkout:

```sh
GOAG_ASSET_ROOT=/absolute/path/to/your/game/root npm run build
```

This path must contain `data/garment_defs/catalog.json`, the definitions listed
there, and the referenced `assets/garments/*.glb`. The viewer does not maintain
or rewrite a second editable catalog. The generated static build necessarily embeds
a read-only copy of the source assets; the game files remain authoritative.

## Feature flag and kill switch

`VITE_WARDROBE_VIEWER_ENABLED` defaults to `true` and `VITE_FA09_OFF` defaults to `0`.

```sh
VITE_FA09_OFF=1 npm run build
```

In OFF mode the browser's original empty `#app` mount is untouched and no viewer
CSS, DOM, WebGL, GLB, or catalog I/O occurs. The staging script also skips all game
reads and removes generated `public/game/`. The sidecar does not inject into or
modify any existing game runtime, so its OFF state leaves the actual game bytes
unchanged. `VITE_WARDROBE_VIEWER_OFF=1` is an equivalent browser kill switch.
A read-only game bridge supports `GOAG_FA09_OFF=1` separately.

## Data contract

The sample uses `goag.garment_def.web.v1` as a **minimal adapter contract**, with
JSON Schema at `game_module/data/garment_defs/garment_def.web.schema.json`.
The actual game's canonical GarmentDef schema was **not included** in the order
input. Do not assume the adapter is the canonical in-game schema or replace
existing game files with sample definitions.

The catalog lists `data/garment_defs/*.garment_def.json`; each definition declares
`model.glb`, expected height in metres, material slots bound by exact GLB material
name, and exactly three colorways with presets per slot. Both generated samples
measure 1.680 m in Y. The displayed readout is measured from loaded geometry,
with a 0.002 m tolerance against the definition's expected height.

The viewer rejects directory traversal and remote URLs in definition references.
The staging step rejects external buffer/image references embedded in GLB files.
It only consumes local, self-contained, binary glTF 2.0 content.

## Test design

Vitest covers parser validity, defensive URL validation, default-ON flags,
non-mutating material replacement, and measured metres. A dependency-free
Node test subset can be run without installing packages on Node 22 or later.
The fixture generator uses only the Python standard library:

```sh
python scripts/generate_mock_glb.py --check
```

To regenerate fixture models in the archive's canonical game module:

```sh
python scripts/generate_mock_glb.py
```

The optional game-side headless script is at
`game_module/tests/wardrobe_contract_test.gd`. Do not copy the standalone
fixture's `project.godot` over an existing project.

## Scope constraints

This is an add-only sidecar for a reference configurator repository. The return
archive also contains a git-apply-able patch. No live site, automation, analytics,
commerce, or hosted dependency is configured. Source license is MIT; no copyleft
sources or data are included in the game module.
