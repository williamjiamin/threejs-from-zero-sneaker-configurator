import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateCatalog, assertCatalog, variantsEnabled, exportWardrobeSwatches, colorwayToUiState,
  applyGltfColorway, applyProceduralFinish,
} from '../src/footwear/material_variants_v1.js';

const fixturePath = new URL('../src/footwear/material_variants_v1.json', import.meta.url);
const catalog = JSON.parse(readFileSync(fixturePath, 'utf8'));
const copy = (value) => JSON.parse(JSON.stringify(value));
const textures = Object.fromEntries(Object.keys(catalog.normal_maps).map((name) => [name, { name }]));
const createMaterial = (name) => ({
  name, color: { value: '#aaaaaa', set(hex) { this.value = hex; } },
  roughness: 0.55, metalness: 0, normalMap: null,
  normalScale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } },
  clone() {
    const other = createMaterial(this.name);
    other.color.value = this.color.value;
    other.roughness = this.roughness;
    other.metalness = this.metalness;
    return other;
  },
});

function fakeRoot() {
  const upper = createMaterial('upper_fabric');
  const outsole = createMaterial('outsole_rubber');
  const accent = createMaterial('accent_trim');
  const laces = createMaterial('laces_thread');
  const inert = createMaterial('unrelated_surface');
  const nodes = [
    { isMesh: true, material: [upper, inert] },
    { isMesh: true, material: accent },
    { isMesh: true, material: outsole },
    { isMesh: true, material: laces },
    { isMesh: false, material: null },
  ];
  const originals = nodes.map((node) => node.material);
  return { nodes, originals, root: { traverse(visit) { nodes.forEach(visit); } } };
}

const resolveNormal = (name) => textures[name];

test('canonical catalog validates with strict references and complete colorways', () => {
  const check = validateCatalog(catalog);
  assert.deepEqual(check, { valid: true, errors: [] });
  assert.strictEqual(assertCatalog(catalog), catalog);
});

test('rejects unknown slots, duplicate material names and invalid cross-references', () => {
  const variant = copy(catalog);
  variant.slots.accent.gltf_material_names.push('upper_fabric');
  variant.colorways.copper_day.upper = 'nonexistent';
  variant.colorways.copper_day.extra_slot = 'x';
  assert.equal(validateCatalog(variant).valid, false);
  assert.throws(() => assertCatalog(variant), /duplicate material name/);
});

test('rejects path traversal, remote paths, missing maps, invalid PBR and extra properties', () => {
  const variant = copy(catalog);
  variant.normal_maps.woven.uri = '../../private.png';
  variant.slots.upper.swatches.copper_woven.normal.map = 'missing';
  variant.slots.upper.swatches.copper_woven.roughness = NaN;
  variant.finishes.mesh.unexpected = 'anything';
  const errors = validateCatalog(variant).errors.join('\n');
  assert.match(errors, /unsafe local PNG path/);
  assert.match(errors, /unknown normal map/);
  assert.match(errors, /must be finite/);
  assert.match(errors, /unexpected: unknown property/);
});

test('default is enabled; env kill switch has priority over opt-in', () => {
  assert.equal(variantsEnabled({}), true);
  assert.equal(variantsEnabled({ FOOTWEAR_VARIANTS_V1_OFF: '1' }), false);
  assert.equal(variantsEnabled({ FOOTWEAR_VARIANTS_V1_OFF: 'TRUE', FOOTWEAR_VARIANTS_V1_ON: '1' }), false);
  assert.equal(variantsEnabled({ FOOTWEAR_VARIANTS_V1_ON: 'false' }), false);
  assert.equal(variantsEnabled({ VITE_FOOTWEAR_VARIANTS_V1_OFF: 'yes' }), false);
  assert.equal(variantsEnabled({ FOOTWEAR_VARIANTS_V1_OFF: '0' }), true);
});

test('bridge export stable and deterministically sorted, carries normal uri and PBR values', () => {
  const first = exportWardrobeSwatches(catalog);
  const second = exportWardrobeSwatches(copy(catalog));
  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'wardrobe.footwear-swatches.v1');
  assert.deepEqual(first.colorways.map((entry) => entry.id), ['copper_day', 'ink_night']);
  const upper = first.colorways[0].slots.find((entry) => entry.slot_id === 'upper');
  assert.equal(upper.normal_uri, 'textures/woven_normal.png');
  assert.equal(upper.base_color, '#f97316');
  assert.deepEqual(upper.gltf_material_names, ['upper_fabric', 'tongue_fabric']);
});

test('named colorway selects the same existing UI slots without modifying source catalog', () => {
  assert.deepEqual(colorwayToUiState(catalog, 'ink_night'), {
    upper: '#111827', accent: '#38bdf8', outsole: '#111827', laces: '#111827',
  });
  assert.equal(colorwayToUiState(catalog, 'not_a_colorway'), null);
});

test('ON swaps glTF material instances without mutating originals; restore returns exact object references', () => {
  const { nodes, originals, root } = fakeRoot();
  const sourceColor = nodes[0].material[0].color.value;
  const report = applyGltfColorway(root, catalog, 'copper_day', { enabled: true, resolveNormal });
  assert.equal(report.enabled, true);
  assert.equal(report.applied, 4);
  assert.deepEqual(report.unmatched_slots, []);
  assert.notStrictEqual(nodes[0].material, originals[0]);
  assert.notStrictEqual(nodes[0].material[0], originals[0][0]);
  assert.strictEqual(nodes[0].material[1], originals[0][1]);
  assert.equal(nodes[0].material[0].color.value, '#f97316');
  assert.equal(nodes[0].material[0].roughness, 0.78);
  assert.equal(nodes[0].material[0].normalScale.x, 0.36);
  assert.strictEqual(nodes[0].material[0].normalMap, textures.woven);
  assert.equal(originals[0][0].color.value, sourceColor);
  report.restore();
  nodes.forEach((node, i) => assert.strictEqual(node.material, originals[i]));
  report.restore();
});

test('OFF is a total no-op, including no traversal, no texture loading, no changed references', () => {
  let called = false;
  const { nodes, originals, root } = fakeRoot();
  root.traverse = () => { called = true; throw new Error('OFF must not traverse'); };
  const result = applyGltfColorway(root, {}, 'missing', { env: { FOOTWEAR_VARIANTS_V1_OFF: '1' } });
  assert.equal(result.enabled, false);
  assert.equal(result.applied, 0);
  assert.equal(called, false);
  nodes.forEach((node, i) => assert.strictEqual(node.material, originals[i]));
  result.restore();
});

test('missing normal texture preflight raises without any mesh mutation', () => {
  const { root, nodes, originals } = fakeRoot();
  assert.throws(() => applyGltfColorway(root, catalog, 'copper_day', {
    enabled: true, resolveNormal: (id) => id === 'grain' ? null : textures[id],
  }), /normal texture unavailable/);
  nodes.forEach((node, i) => assert.strictEqual(node.material, originals[i]));
});

test('missing glTF slot preflight raises unless partial matching explicitly enabled', () => {
  const { nodes, originals, root } = fakeRoot();
  nodes[2].material = createMaterial('not_an_outsole');
  assert.throws(() => applyGltfColorway(root, catalog, 'copper_day', { enabled: true, resolveNormal }), /unmatched glTF slots/);
  assert.strictEqual(nodes[0].material, originals[0]);
  const report = applyGltfColorway(root, catalog, 'copper_day', { enabled: true, resolveNormal, requireAllSlots: false });
  assert.deepEqual(report.unmatched_slots, ['outsole']);
  report.restore();
});

test('same original material shared by two meshes is cloned once and restored separately', () => {
  const { nodes, root } = fakeRoot();
  const shared = nodes[1].material;
  nodes.push({ isMesh: true, material: shared });
  const report = applyGltfColorway(root, catalog, 'ink_night', { enabled: true, resolveNormal });
  assert.strictEqual(nodes[1].material, nodes.at(-1).material);
  assert.notStrictEqual(nodes[1].material, shared);
  report.restore();
  assert.strictEqual(nodes[1].material, shared);
  assert.strictEqual(nodes.at(-1).material, shared);
});

test('procedural PBR change respects gate and original UI color', () => {
  const upper = createMaterial('upper_fabric');
  const tongue = createMaterial('tongue_fabric');
  upper.color.value = '#123456';
  const accent = createMaterial('accent_trim');
  const outsole = createMaterial('outsole_rubber');
  const laces = createMaterial('laces_thread');
  const materials = { upper, tongue, accent, outsole, laces };
  const before = JSON.stringify(materials);
  const options = { state: { accent: '#38bdf8', outsole: '#111827', laces: '#f8fafc' } };
  assert.equal(applyProceduralFinish(materials, catalog, 'suede', textures, { ...options, enabled: false }), false);
  assert.equal(JSON.stringify(materials), before);
  assert.equal(applyProceduralFinish(materials, catalog, 'suede', textures, { ...options, enabled: true }), true);
  assert.equal(materials.upper.roughness, 0.92);
  assert.ok(Math.abs(materials.tongue.roughness - 0.84) < 1e-12);
  assert.equal(materials.upper.color.value, '#123456');
  assert.strictEqual(materials.upper.normalMap, textures.grain);
  assert.equal(materials.upper.normalScale.x, 0.46);
  assert.equal(materials.accent.roughness, 0.4);
  assert.equal(materials.outsole.roughness, 0.92);
  assert.strictEqual(materials.laces.normalMap, textures.woven);
});

test('schema, local normal textures and their MIME signatures are present', () => {
  const schema = JSON.parse(readFileSync(new URL('../src/footwear/material_variants_v1.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.$id, 'urn:footwear:material-variants:v1');
  assert.equal(schema.properties.schema_version.const, catalog.schema_version);
  for (const map of Object.values(catalog.normal_maps)) {
    const path = new URL('../src/footwear/' + map.uri, import.meta.url);
    const data = readFileSync(path);
    assert.deepEqual(data.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.ok(data.byteLength > 100);
  }
});
