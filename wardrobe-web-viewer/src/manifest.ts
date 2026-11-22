import { assertRelativeAssetPath } from "./assetUrl.ts";

export interface MaterialPreset {
  color: string;
  roughness: number;
  metalness: number;
}
export interface MaterialSlot {
  id: string;
  match_material: string;
}
export interface Colorway {
  id: string;
  name: string;
  swatch: string;
  materials: Record<string, MaterialPreset>;
}
export interface GarmentDef {
  schema: "goag.garment_def.web.v1";
  id: string;
  name: string;
  description: string;
  model: {
    glb: string;
    unit: "m";
    up_axis: "Y";
    expected_height_m: number;
  };
  material_slots: MaterialSlot[];
  colorways: Colorway[];
}
export interface WardrobeCatalog {
  schema: "goag.wardrobe.catalog.v1";
  garment_defs: string[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function simpleId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_]{1,47}$/.test(value);
}
function label(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 120;
}
function hex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
function unitInterval(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function unique(ids: string[]): boolean { return new Set(ids).size === ids.length; }

export function parseCatalog(value: unknown): WardrobeCatalog {
  if (!record(value) || value.schema !== "goag.wardrobe.catalog.v1" ||
      !Array.isArray(value.garment_defs) || value.garment_defs.length < 1 ||
      value.garment_defs.length > 24) throw new Error("Invalid wardrobe catalog");
  for (const path of value.garment_defs) {
    assertRelativeAssetPath(path);
    if (!path.startsWith("data/garment_defs/") || !path.endsWith(".garment_def.json")) {
      throw new Error("Catalog definitions must be game-local garment JSON");
    }
  }
  if (!unique(value.garment_defs)) throw new Error("Duplicate garment definition path");
  return value as unknown as WardrobeCatalog;
}

export function parseGarmentDef(value: unknown): GarmentDef {
  if (!record(value) || value.schema !== "goag.garment_def.web.v1" ||
      !simpleId(value.id) || !label(value.name) ||
      typeof value.description !== "string" || value.description.length > 500) {
    throw new Error("Invalid garment definition header");
  }
  const model = value.model;
  if (!record(model)) throw new Error("Missing garment GLB model");
  assertRelativeAssetPath(model.glb);
  if (!model.glb.startsWith("assets/garments/") || !model.glb.endsWith(".glb") ||
      model.unit !== "m" || model.up_axis !== "Y" ||
      typeof model.expected_height_m !== "number" || !Number.isFinite(model.expected_height_m) ||
      model.expected_height_m <= 0 || model.expected_height_m > 3.5) {
    throw new Error("Invalid garment model metadata");
  }
  if (!Array.isArray(value.material_slots) || value.material_slots.length < 1 ||
      value.material_slots.length > 12 || !value.material_slots.every((s: unknown) =>
        record(s) && simpleId(s.id) && simpleId(s.match_material))) {
    throw new Error("Invalid garment material slots");
  }
  const slots = value.material_slots as MaterialSlot[];
  if (!unique(slots.map((slot) => slot.id)) || !unique(slots.map((slot) => slot.match_material))) {
    throw new Error("Duplicate material slot");
  }
  if (!Array.isArray(value.colorways) || value.colorways.length !== 3) {
    throw new Error("Three colorways are required");
  }
  const colorways = value.colorways as unknown[];
  const slotIds = slots.map((slot) => slot.id).sort();
  for (const colorway of colorways) {
    if (!record(colorway) || !simpleId(colorway.id) || !label(colorway.name) ||
        !hex(colorway.swatch) || !record(colorway.materials) ||
        JSON.stringify(Object.keys(colorway.materials).sort()) !== JSON.stringify(slotIds)) {
      throw new Error("Invalid colorway or missing material slot");
    }
    for (const preset of Object.values(colorway.materials)) {
      if (!record(preset) || !hex(preset.color) || !unitInterval(preset.roughness) ||
          !unitInterval(preset.metalness)) throw new Error("Invalid material preset");
    }
  }
  if (!unique(colorways.map((item) => (item as Colorway).id))) {
    throw new Error("Duplicate colorway IDs");
  }
  return value as unknown as GarmentDef;
}
