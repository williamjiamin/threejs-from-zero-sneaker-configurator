import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCatalog, parseGarmentDef } from "../src/manifest.ts";

const gameRoot = fileURLToPath(new URL("./fixtures/", import.meta.url));
const load = (path: string): unknown => JSON.parse(readFileSync(`${gameRoot}${path}`, "utf8"));

it("loads exactly two canonical garments with three colorways each", () => {
  const catalog = parseCatalog(load("data/garment_defs/catalog.json"));
  expect(catalog.garment_defs).toHaveLength(2);
  for (const path of catalog.garment_defs) {
    const def = parseGarmentDef(load(path));
    expect(def.colorways).toHaveLength(3);
    expect(def.material_slots).toHaveLength(3);
    expect(def.model.expected_height_m).toBe(1.68);
  }
});

describe("defensive contract validation", () => {
  it("rejects duplicate ids, missing material slots and malformed colors", () => {
    const value = load("data/garment_defs/field_coat.garment_def.json");
    const copy = structuredClone(value) as Record<string, any>;
    copy.colorways[1].id = copy.colorways[0].id;
    expect(() => parseGarmentDef(copy)).toThrow();
    copy.colorways[1].id = "changed";
    delete copy.colorways[1].materials.trim;
    expect(() => parseGarmentDef(copy)).toThrow();
    copy.colorways[1].materials.trim = { color: "red", roughness: 0.5, metalness: 0 };
    expect(() => parseGarmentDef(copy)).toThrow();
  });
  it("rejects catalog with duplicate entries", () => {
    expect(() => parseCatalog({schema:"goag.wardrobe.catalog.v1", garment_defs:[
      "data/garment_defs/field_coat.garment_def.json",
      "data/garment_defs/field_coat.garment_def.json"
    ]})).toThrow();
  });
});
