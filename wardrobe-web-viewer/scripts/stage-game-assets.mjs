#!/usr/bin/env node
/**
 * Stage a single canonical game export for local static builds. No remote I/O.
 * The generated public/game directory is ignored and may be overwritten.
 */
import { readFile, copyFile, mkdir, rm, lstat, realpath } from "node:fs/promises";
import { dirname, resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const viewerRoot = resolve(here, "..");
import { existsSync } from "node:fs";
const defaultAssetRoot = existsSync(resolve(here, "../../../game_module/data/garment_defs/catalog.json"))
  ? resolve(here, "../../../game_module")
  : resolve(here, "../tests/fixtures");
const source = resolve(process.env.GOAG_ASSET_ROOT || defaultAssetRoot);
const destination = resolve(viewerRoot, "public/game");
const off = ["1", "true", "yes", "on"].includes(
  String(process.env.VITE_FA09_OFF || process.env.VITE_WARDROBE_VIEWER_OFF || "").trim().toLowerCase()
);
if (off) {
  // OFF mode does not even read the game export or leave staged files behind.
  await rm(destination, { recursive: true, force: true });
  console.log("PASS kill_switch_prevents_asset_staging");
  console.log("ALL=true");
  process.exit(0);
}
const root = await realpath(source);
const staged = new Set();

function safePath(path) {
  if (typeof path !== "string" || !/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(path) ||
      path.split("/").some((part) => part === "." || part === ".." || part.startsWith("."))) {
    throw new Error(`Unsafe game-relative path: ${String(path)}`);
  }
  return path;
}

async function readLocal(path) {
  safePath(path);
  const absolute = resolve(root, path);
  if (!absolute.startsWith(root + sep)) throw new Error("Path escapes game root");
  const meta = await lstat(absolute);
  if (!meta.isFile() || meta.isSymbolicLink()) throw new Error(`Asset must be an ordinary file: ${path}`);
  const checked = await realpath(absolute);
  if (!checked.startsWith(root + sep)) throw new Error(`Asset resolves outside root: ${path}`);
  return readFile(checked);
}

async function stage(path) {
  if (staged.has(path)) return;
  const bytes = await readLocal(path);
  await mkdir(dirname(join(destination, path)), { recursive: true });
  await copyFile(resolve(root, path), join(destination, path));
  staged.add(path);
  return bytes;
}

function validateGlb(bytes, name) {
  if (bytes.length < 28 || bytes.toString("utf8", 0, 4) !== "glTF" ||
      bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length ||
      bytes.readUInt32LE(16) !== 0x4E4F534A) {
    throw new Error(`Invalid binary glTF: ${name}`);
  }
  const jsonEnd = 20 + bytes.readUInt32LE(12);
  if (jsonEnd > bytes.length) throw new Error(`Invalid JSON chunk: ${name}`);
  const gltf = JSON.parse(bytes.toString("utf8", 20, jsonEnd));
  if (gltf.asset?.version !== "2.0") throw new Error(`Unsupported model version: ${name}`);
  for (const node of [...(gltf.buffers || []), ...(gltf.images || [])]) {
    if (node.uri !== undefined) throw new Error(`External GLB reference forbidden: ${name}`);
  }
  return gltf;
}

try {
  // Ensure a failed stage cannot leave stale assets that appear to be current.
  await rm(destination, { recursive: true, force: true });
  const catalogPath = "data/garment_defs/catalog.json";
  const catalog = JSON.parse((await stage(catalogPath)).toString("utf8"));
  if (catalog.schema !== "goag.wardrobe.catalog.v1" ||
      !Array.isArray(catalog.garment_defs) || catalog.garment_defs.length === 0 ||
      catalog.garment_defs.length > 24 ||
      new Set(catalog.garment_defs).size !== catalog.garment_defs.length) {
    throw new Error("Invalid local catalog");
  }
  const ids = new Set();
  for (const path of catalog.garment_defs) {
    if (!path.startsWith("data/garment_defs/") || !path.endsWith(".garment_def.json")) {
      throw new Error(`Invalid garment manifest reference: ${path}`);
    }
    const def = JSON.parse((await stage(path)).toString("utf8"));
    if (def.schema !== "goag.garment_def.web.v1" || typeof def.id !== "string" ||
        ids.has(def.id) || !def.model || !Array.isArray(def.material_slots) ||
        !Array.isArray(def.colorways) || def.colorways.length !== 3 ||
        def.model.unit !== "m" || def.model.up_axis !== "Y") {
      throw new Error(`Invalid garment definition: ${path}`);
    }
    ids.add(def.id);
    const glbPath = def.model.glb;
    safePath(glbPath);
    if (!glbPath.startsWith("assets/garments/") || !glbPath.endsWith(".glb")) {
      throw new Error("Model must be a local garment GLB");
    }
    const glb = await stage(glbPath);
    const scene = validateGlb(glb, glbPath);
    const names = new Set((scene.materials || []).map((mat) => mat.name));
    for (const slot of def.material_slots) {
      if (!names.has(slot.match_material)) throw new Error(`Missing GLB slot ${slot.id}: ${glbPath}`);
    }
  }
  console.log(`PASS staged ${ids.size} garments and ${staged.size} game files from ${root}`);
  console.log("ALL=true");
} catch (error) {
  await rm(destination, { recursive: true, force: true });
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  console.error("ALL=false");
  process.exitCode = 1;
}
