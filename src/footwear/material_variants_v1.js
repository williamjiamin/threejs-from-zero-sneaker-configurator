/** Original, dependency-free v1 contract shared by the viewer and wardrobe adapter. */
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const TEXTURE_PATH = /^textures\/[a-z0-9_-]+\.png$/;
const VERSION = 'footwear.material-variants.v1';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUnit = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const isId = (value) => typeof value === 'string' && IDENTIFIER.test(value);
const owns = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Strict structural and cross-reference checks. No network, disk, or rendering side effects. */
export function validateCatalog(catalog) {
  const errors = [];
  const error = (path, reason) => errors.push(`${path}: ${reason}`);
  const checkKeys = (object, required, path) => {
    if (!isRecord(object)) { error(path, 'expected object'); return false; }
    for (const key of required) if (!owns(object, key)) error(`${path}.${key}`, 'missing');
    for (const key of Object.keys(object)) if (!required.includes(key)) error(`${path}.${key}`, 'unknown property');
    return true;
  };
  const checkNormal = (normal, path, maps) => {
    if (!checkKeys(normal, ['map', 'scale'], path)) return;
    if (!isId(normal.map) || !owns(maps, normal.map)) error(`${path}.map`, 'unknown normal map');
    if (typeof normal.scale !== 'number' || !Number.isFinite(normal.scale) || normal.scale < 0 || normal.scale > 2)
      error(`${path}.scale`, 'must be finite in [0,2]');
  };
  const checkPbr = (pbr, path, maps, finish = false) => {
    const keys = finish ? ['roughness', 'metallic', 'clearcoat', 'sheen', 'normal'] : ['base_color', 'roughness', 'metallic', 'normal'];
    if (!checkKeys(pbr, keys, path)) return;
    if (!finish && (typeof pbr.base_color !== 'string' || !COLOR.test(pbr.base_color)))
      error(`${path}.base_color`, 'expected #RRGGBB');
    for (const key of keys.filter((key) => !['normal', 'base_color'].includes(key)))
      if (!isUnit(pbr[key])) error(`${path}.${key}`, 'must be finite in [0,1]');
    checkNormal(pbr.normal, `${path}.normal`, maps);
  };

  if (!checkKeys(catalog, ['schema_version', 'asset_id', 'normal_maps', 'slots', 'colorways', 'finishes'], 'catalog'))
    return { valid: false, errors };
  if (catalog.schema_version !== VERSION) error('schema_version', `must equal ${VERSION}`);
  if (!isId(catalog.asset_id)) error('asset_id', 'invalid identifier');
  const maps = isRecord(catalog.normal_maps) ? catalog.normal_maps : {};
  if (!Object.keys(maps).length) error('normal_maps', 'at least one map required');
  if (!isRecord(catalog.normal_maps)) error('normal_maps', 'expected object');
  for (const [id, info] of Object.entries(maps)) {
    if (!isId(id)) error(`normal_maps.${id}`, 'invalid identifier');
    if (!checkKeys(info, ['uri', 'space'], `normal_maps.${id}`)) continue;
    if (typeof info.uri !== 'string' || !TEXTURE_PATH.test(info.uri)) error(`normal_maps.${id}.uri`, 'unsafe local PNG path');
    if (info.space !== 'tangent') error(`normal_maps.${id}.space`, 'must be tangent');
  }

  const slots = isRecord(catalog.slots) ? catalog.slots : {};
  if (!isRecord(catalog.slots) || !Object.keys(slots).length) error('slots', 'nonempty object required');
  const names = new Set();
  for (const [id, slot] of Object.entries(slots)) {
    if (!isId(id)) error(`slots.${id}`, 'invalid identifier');
    if (!checkKeys(slot, ['gltf_material_names', 'swatches'], `slots.${id}`)) continue;
    if (!Array.isArray(slot.gltf_material_names) || slot.gltf_material_names.length === 0) {
      error(`slots.${id}.gltf_material_names`, 'nonempty array required');
    } else {
      const local = new Set();
      for (const name of slot.gltf_material_names) {
        if (!isId(name)) error(`slots.${id}.gltf_material_names`, 'invalid material name');
        if (local.has(name) || names.has(name)) error(`slots.${id}.gltf_material_names`, `duplicate material name: ${name}`);
        local.add(name); names.add(name);
      }
    }
    if (!isRecord(slot.swatches) || !Object.keys(slot.swatches).length) error(`slots.${id}.swatches`, 'nonempty object required');
    for (const [swatchId, pbr] of Object.entries(isRecord(slot.swatches) ? slot.swatches : {})) {
      if (!isId(swatchId)) error(`slots.${id}.swatches.${swatchId}`, 'invalid identifier');
      checkPbr(pbr, `slots.${id}.swatches.${swatchId}`, maps);
    }
  }

  const colorways = isRecord(catalog.colorways) ? catalog.colorways : {};
  if (!isRecord(catalog.colorways) || !Object.keys(colorways).length) error('colorways', 'nonempty object required');
  for (const [id, selection] of Object.entries(colorways)) {
    if (!isId(id)) error(`colorways.${id}`, 'invalid identifier');
    if (!isRecord(selection)) { error(`colorways.${id}`, 'expected object'); continue; }
    for (const slotId of Object.keys(slots)) {
      if (!owns(selection, slotId)) error(`colorways.${id}.${slotId}`, 'missing slot selection');
      else if (!owns(isRecord(slots[slotId]?.swatches) ? slots[slotId].swatches : {}, selection[slotId]))
        error(`colorways.${id}.${slotId}`, 'unknown swatch');
    }
    for (const slotId of Object.keys(selection)) if (!owns(slots, slotId)) error(`colorways.${id}.${slotId}`, 'unknown slot');
  }

  const finishes = isRecord(catalog.finishes) ? catalog.finishes : {};
  if (!isRecord(catalog.finishes) || !Object.keys(finishes).length) error('finishes', 'nonempty object required');
  for (const [id, pbr] of Object.entries(finishes)) {
    if (!isId(id)) error(`finishes.${id}`, 'invalid identifier');
    checkPbr(pbr, `finishes.${id}`, maps, true);
  }
  return { valid: errors.length === 0, errors };
}

export function assertCatalog(catalog) {
  const result = validateCatalog(catalog);
  if (!result.valid) throw new TypeError(result.errors.join('\n'));
  return catalog;
}

function flagSet(value) {
  return value === true || (typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()));
}

/** Defaults ON. The OFF environment variable always takes precedence over a positive flag. */
export function variantsEnabled(env = null) {
  const runtimeEnv = env ?? {
    FOOTWEAR_VARIANTS_V1_OFF: typeof process !== 'undefined' ? process.env?.FOOTWEAR_VARIANTS_V1_OFF : undefined,
    FOOTWEAR_VARIANTS_V1_ON: typeof process !== 'undefined' ? process.env?.FOOTWEAR_VARIANTS_V1_ON : undefined,
    VITE_FOOTWEAR_VARIANTS_V1_OFF: import.meta.env?.VITE_FOOTWEAR_VARIANTS_V1_OFF,
    VITE_FOOTWEAR_VARIANTS_V1_ON: import.meta.env?.VITE_FOOTWEAR_VARIANTS_V1_ON,
  };
  if (flagSet(runtimeEnv.FOOTWEAR_VARIANTS_V1_OFF) || flagSet(runtimeEnv.VITE_FOOTWEAR_VARIANTS_V1_OFF)) return false;
  if (['0', 'false', 'no', 'off'].includes(String(runtimeEnv.FOOTWEAR_VARIANTS_V1_ON).toLowerCase()) ||
      ['0', 'false', 'no', 'off'].includes(String(runtimeEnv.VITE_FOOTWEAR_VARIANTS_V1_ON).toLowerCase())) return false;
  return true;
}

/** Stable, JSON-only, engine-agnostic bridge derived exclusively from the canonical catalog. */
export function exportWardrobeSwatches(catalog) {
  assertCatalog(catalog);
  const colorways = Object.keys(catalog.colorways).sort().map((id) => ({
    id,
    slots: Object.keys(catalog.slots).sort().map((slotId) => {
      const swatchId = catalog.colorways[id][slotId];
      const swatch = catalog.slots[slotId].swatches[swatchId];
      const normal = catalog.normal_maps[swatch.normal.map];
      return {
        slot_id: slotId, swatch_id: swatchId,
        gltf_material_names: [...catalog.slots[slotId].gltf_material_names],
        base_color: swatch.base_color, roughness: swatch.roughness, metallic: swatch.metallic,
        normal_uri: normal.uri, normal_scale: swatch.normal.scale,
      };
    }),
  }));
  return { schema_version: 'wardrobe.footwear-swatches.v1', asset_id: catalog.asset_id, colorways };
}

function visitMeshes(root, fn) {
  if (!root || typeof root.traverse !== 'function') throw new TypeError('root must support traverse(callback)');
  root.traverse((node) => { if (node && node.isMesh) fn(node); });
}

/**
 * Transactionally replace imported glTF material references. Caller supplies local, preloaded
 * tangent-space textures by map id. Restoring uses the exact original material objects/arrays.
 * This adapter does not mutate shared source materials, mesh geometry, or the legacy render path.
 */
export function applyGltfColorway(root, catalog, colorwayId, options = {}) {
  if (options.enabled === false || (options.enabled === undefined && !variantsEnabled(options.env)))
    return { enabled: false, applied: 0, unmatched_slots: [], restore() {} };
  assertCatalog(catalog);
  if (!owns(catalog.colorways, colorwayId)) throw new RangeError(`unknown colorway: ${colorwayId}`);
  if (typeof options.resolveNormal !== 'function') throw new TypeError('resolveNormal(map_id, uri) required');

  const rules = new Map();
  for (const [slotId, slot] of Object.entries(catalog.slots)) {
    const swatch = slot.swatches[catalog.colorways[colorwayId][slotId]];
    for (const name of slot.gltf_material_names) rules.set(name, { slotId, swatch });
  }
  const edits = [];
  const matched = new Set();
  visitMeshes(root, (mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some((material) => material && rules.has(material.name))) return;
    edits.push({ mesh, original: mesh.material, materials });
    for (const material of materials) if (material && rules.has(material.name)) matched.add(rules.get(material.name).slotId);
  });
  const unmatched = Object.keys(catalog.slots).filter((id) => !matched.has(id));
  if (options.requireAllSlots !== false && unmatched.length)
    throw new Error(`unmatched glTF slots: ${unmatched.join(', ')}`);

  // Resolve every required texture before cloning or changing a mesh.
  const resolved = new Map();
  for (const edit of edits) for (const material of edit.materials) {
    if (!material || !rules.has(material.name)) continue;
    const normal = rules.get(material.name).swatch.normal;
    if (!resolved.has(normal.map)) {
      const map = catalog.normal_maps[normal.map];
      const texture = options.resolveNormal(normal.map, map.uri);
      if (!texture) throw new Error(`normal texture unavailable: ${normal.map}`);
      resolved.set(normal.map, texture);
    }
    if (typeof material.clone !== 'function') throw new TypeError('mesh material must implement clone()');
  }

  const copies = new Map();
  for (const edit of edits) {
    const revised = edit.materials.map((original) => {
      if (!original || !rules.has(original.name)) return original;
      const rule = rules.get(original.name);
      const cacheKey = rule.slotId;
      let bySlot = copies.get(original);
      if (!bySlot) { bySlot = new Map(); copies.set(original, bySlot); }
      if (bySlot.has(cacheKey)) return bySlot.get(cacheKey);
      const clone = original.clone();
      const pbr = rule.swatch;
      if (!clone.color || typeof clone.color.set !== 'function') throw new TypeError('material lacks color.set()');
      clone.color.set(pbr.base_color);
      clone.roughness = pbr.roughness;
      clone.metalness = pbr.metallic;
      clone.normalMap = resolved.get(pbr.normal.map);
      if (!clone.normalScale || typeof clone.normalScale.set !== 'function') throw new TypeError('material lacks normalScale.set()');
      clone.normalScale.set(pbr.normal.scale, pbr.normal.scale);
      clone.needsUpdate = true;
      bySlot.set(cacheKey, clone);
      return clone;
    });
    edit.installed = Array.isArray(edit.original) ? revised : revised[0];
  }
  // No meshes have been modified until this point.
  for (const edit of edits) edit.mesh.material = edit.installed;
  let restored = false;
  return {
    enabled: true, applied: edits.length, unmatched_slots: unmatched,
    restore() {
      if (restored) return;
      for (const edit of edits) if (edit.mesh.material === edit.installed) edit.mesh.material = edit.original;
      restored = true;
    },
  };
}

/** Resolve one named colorway to the existing configurator's four independent color keys. */
export function colorwayToUiState(catalog, colorwayId) {
  assertCatalog(catalog);
  if (!owns(catalog.colorways, colorwayId)) return null;
  const state = {};
  for (const [slotId, swatchId] of Object.entries(catalog.colorways[colorwayId]))
    state[slotId] = catalog.slots[slotId].swatches[swatchId].base_color;
  return state;
}

/** Optional PBR enhancement of the existing procedural sample. UI colors remain authoritative. */
export function applyProceduralFinish(materials, catalog, finishId, textures, options = {}) {
  if (options.enabled === false || (options.enabled === undefined && !variantsEnabled(options.env))) return false;
  assertCatalog(catalog);
  const finish = catalog.finishes[finishId];
  if (!finish) throw new RangeError(`unknown finish: ${finishId}`);

  const state = options.state ?? {};
  const otherSlots = ['accent', 'outsole', 'laces'].map((id) => {
    const slot = catalog.slots[id];
    if (!slot) throw new TypeError(`missing procedural slot: ${id}`);
    const swatch = Object.values(slot.swatches).find((item) => item.base_color.toLowerCase() === String(state[id]).toLowerCase())
      ?? Object.values(slot.swatches)[0];
    return { id, swatch };
  });
  for (const id of ['upper', 'tongue', ...otherSlots.map((slot) => slot.id)])
    if (!materials[id] || !materials[id].normalScale?.set) throw new TypeError(`missing procedural material: ${id}`);
  for (const mapId of [finish.normal.map, ...otherSlots.map((slot) => slot.swatch.normal.map)])
    if (!textures[mapId]) throw new Error(`normal texture unavailable: ${mapId}`);

  for (const [id, offset] of [['upper', 0], ['tongue', 0.08]]) {
    const material = materials[id];
    material.roughness = Math.max(0, finish.roughness - offset);
    material.metalness = finish.metallic;
    material.clearcoat = id === 'tongue' ? Math.max(0.02, finish.clearcoat * 0.75) : finish.clearcoat;
    material.sheen = finish.sheen;
    const normalTexture = textures[finish.normal.map];
    if (material.normalMap !== normalTexture) {
      material.normalMap = normalTexture;
      material.bumpMap = null;
      material.needsUpdate = true;
    }
    material.normalScale.set(finish.normal.scale, finish.normal.scale);
  }
  for (const { id, swatch } of otherSlots) {
    const material = materials[id];
    material.roughness = swatch.roughness;
    material.metalness = swatch.metallic;
    if (material.normalMap !== textures[swatch.normal.map]) {
      material.normalMap = textures[swatch.normal.map];
      material.needsUpdate = true;
    }
    material.normalScale.set(swatch.normal.scale, swatch.normal.scale);
  }
  return true;
}
