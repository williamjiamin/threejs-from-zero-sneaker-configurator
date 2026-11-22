import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { enabled } from "../src/featureFlags.ts";
import { assetUrl, assertRelativeAssetPath } from "../src/assetUrl.ts";
import { parseCatalog, parseGarmentDef } from "../src/manifest.ts";

const game = fileURLToPath(new URL("./fixtures/", import.meta.url));
const load = (path) => JSON.parse(readFileSync(`${game}${path}`, "utf8"));

test("default ON; killswitch overrides the flag", () => {
  assert.equal(enabled({}), true);
  assert.equal(enabled({ VITE_WARDROBE_VIEWER_ENABLED: "true", VITE_FA09_OFF: "1" }), false);
  assert.equal(enabled({ VITE_WARDROBE_VIEWER_OFF: "true" }), false);
});

test("exactly two supported garments, each with three colorways", () => {
  const catalog = parseCatalog(load("data/garment_defs/catalog.json"));
  assert.equal(catalog.garment_defs.length, 2);
  for (const path of catalog.garment_defs) {
    const def = parseGarmentDef(load(path));
    assert.equal(def.colorways.length, 3);
    assert.equal(def.model.expected_height_m, 1.68);
  }
});

test("rejects unsafe URLs and missing colorway slot", () => {
  for (const path of ["../file", "https://external.invalid/x", "assets/%2e%2e/x", "a\\b", "/root/x"]) {
    assert.throws(() => assertRelativeAssetPath(path));
  }
  assert.equal(assetUrl("assets/garments/travel_robe.glb", "http://localhost/game/"),
               "http://localhost/game/assets/garments/travel_robe.glb");
  const broken = structuredClone(load("data/garment_defs/field_coat.garment_def.json"));
  delete broken.colorways[0].materials.trim;
  assert.throws(() => parseGarmentDef(broken));
});
