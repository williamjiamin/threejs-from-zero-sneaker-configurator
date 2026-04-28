import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const STAGES = {
  1: { short: 'Scene scaffold', copy: 'Bootstrap the viewer shell, lighting, and stand-in sneaker asset.' },
  2: { short: 'Variant binding', copy: 'Map state to material slots so one model can serve multiple colorways.' },
  3: { short: 'Per-part swap', copy: 'Switch silhouettes and part presets without losing a coherent state model.' },
  4: { short: 'Material fidelity', copy: 'Give mesh, suede, leather, and gloss distinct rendering identities.' },
  5: { short: 'Decal layer', copy: 'Turn branding and monograms into a reusable texture-authoring surface.' },
  6: { short: 'Mobile perf', copy: 'Show how the build degrades intentionally under a tighter mobile GPU budget.' },
  7: { short: 'Share + analytics', copy: 'Serialize the config into the URL and emit commerce-shaped events.' },
  8: { short: 'AR routing', copy: 'Model how the product routes to Quick Look, Scene Viewer, or WebXR.' },
  9: { short: 'Photo mode', copy: 'Expose a predictable screenshot path for catalog and campaign outputs.' },
 10: { short: 'Storefront handoff', copy: 'Surface the embed contract and storefront language of a real merchant handoff.' },
};

const COLORS = {
  upper: ['#f97316', '#111827', '#16a34a', '#f8fafc', '#7c2d12'],
  accent: ['#111827', '#fbbf24', '#38bdf8', '#ec4899', '#f8fafc'],
  outsole: ['#f8fafc', '#111827', '#fde68a', '#d6d3d1'],
  laces: ['#f8fafc', '#111827', '#fb7185', '#a3e635'],
};

const silhouettes = {
  runner: { upperX: 1, upperY: 1, upperZ: 1, heelHeight: 1, toeLength: 1, soleY: 1 },
  court: { upperX: 1.06, upperY: 0.94, upperZ: 0.96, heelHeight: 0.92, toeLength: 0.92, soleY: 0.92 },
  trail: { upperX: 0.98, upperY: 1.08, upperZ: 1.08, heelHeight: 1.15, toeLength: 1.06, soleY: 1.16 },
};

const materialPresets = {
  mesh: { roughness: 0.78, metalness: 0.02, clearcoat: 0.04, sheen: 0.24 },
  suede: { roughness: 0.92, metalness: 0.01, clearcoat: 0.0, sheen: 0.52 },
  leather: { roughness: 0.46, metalness: 0.03, clearcoat: 0.22, sheen: 0.12 },
  gloss: { roughness: 0.22, metalness: 0.06, clearcoat: 0.58, sheen: 0.0 },
};

const params = new URLSearchParams(window.location.search);
let stage = clampStage(Number(params.get("stage") || 10));
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  upper: '#f97316',
  accent: '#111827',
  outsole: '#f8fafc',
  laces: '#f8fafc',
  silhouette: 'runner',
  material: 'mesh',
  decal: true,
  lowPower: false,
  autoRotate: !prefersReducedMotion,
};

const viewer = document.getElementById("viewer");
const stageSelect = document.getElementById("stage-select");
const stageSummary = document.getElementById("stage-summary");
const stageTitle = document.getElementById("stage-title");
const stageCopy = document.getElementById("stage-copy");
const statsEl = document.getElementById("stats");
const logEl = document.getElementById("event-log");
const buildPill = document.getElementById("build-pill");
const embedSnippet = document.getElementById("embed-snippet");
const notice = document.getElementById("notice");

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070707);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
camera.position.set(4.6, 2.2, 6.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 11;
controls.target.set(0.2, 1.2, 0);
controls.update();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;

const hemi = new THREE.HemisphereLight(0xfff3e8, 0x2d1b11, 1.1);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.9);
keyLight.position.set(5, 8, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xffbf80, 1.2);
rimLight.position.set(-4, 3, -6);
scene.add(rimLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(7, 64),
  new THREE.MeshStandardMaterial({ color: 0x120d09, roughness: 0.96, metalness: 0.0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(2.4, 0.05, 18, 120),
  new THREE.MeshBasicMaterial({ color: 0x2d1b11 })
);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.03;
scene.add(ring);

const materials = createMaterials();
const shoe = buildShoe(materials);
scene.add(shoe.group);

hydrateFromUrl();
mountColorRow("upper-swatches", "upper", COLORS.upper);
mountColorRow("accent-swatches", "accent", COLORS.accent);
mountColorRow("outsole-swatches", "outsole", COLORS.outsole);
mountColorRow("laces-swatches", "laces", COLORS.laces);

document.getElementById("silhouette-select").addEventListener("change", (event) => { state.silhouette = event.target.value; applyState(true, "3d_silhouette_change", { silhouette: state.silhouette }); });
document.getElementById("material-select").addEventListener("change", (event) => { state.material = event.target.value; applyState(true, "3d_material_change", { material: state.material }); });
document.getElementById("decal-btn").addEventListener("click", () => { state.decal = !state.decal; applyState(true, "3d_decal_toggle", { enabled: state.decal }); });
document.getElementById("perf-btn").addEventListener("click", () => { state.lowPower = !state.lowPower; applyPerformanceMode(); applyState(true, "3d_perf_toggle", { lowPower: state.lowPower }); });
document.getElementById("share-btn").addEventListener("click", copyShareUrl);
document.getElementById("random-btn").addEventListener("click", randomize);
document.getElementById("ar-btn").addEventListener("click", launchAR);
document.getElementById("photo-btn").addEventListener("click", savePng);
document.getElementById("cart-btn").addEventListener("click", () => pushEvent("3d_add_to_cart", { stage: stage, config: exportState(), price: computePrice() }));
document.getElementById("rotate-btn").addEventListener("click", () => { state.autoRotate = !state.autoRotate; notify(state.autoRotate ? "Auto-rotate on" : "Auto-rotate off"); });
document.getElementById("reset-btn").addEventListener("click", resetState);
stageSelect.addEventListener("change", (event) => setStage(Number(event.target.value)));

window.addEventListener("resize", resize);
resize();
setStage(stage, false);
applyPerformanceMode();
applyState(false);
pushEvent("3d_session_start", { stage: stage });

let lastStat = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  if (state.autoRotate && !prefersReducedMotion) {
    shoe.group.rotation.y += 0.005;
  }
  controls.update();
  renderer.render(scene, camera);
  if (now - lastStat > 250) {
    updateStats();
    lastStat = now;
  }
}
requestAnimationFrame(animate);

function clampStage(value) {
  if (!Number.isFinite(value)) return 10;
  return Math.min(10, Math.max(1, Math.round(value)));
}

function setStage(value, log = true) {
  stage = clampStage(value);
  stageSelect.value = String(stage);
  params.set("stage", String(stage));
  history.replaceState(null, "", "?" + params.toString());
  document.querySelectorAll("[data-min-stage]").forEach((el) => {
    el.hidden = stage < Number(el.dataset.minStage);
  });
  buildPill.textContent = "Checkpoint p1-" + String(stage).padStart(2, "0");
  stageTitle.textContent = "Stage " + stage + " · " + STAGES[stage].short;
  stageCopy.textContent = STAGES[stage].copy;
  stageSummary.textContent = STAGES[stage].copy;
  embedSnippet.textContent = "<iframe src=\"https://threejs-from-zero.dev/projects/sneaker-configurator/\" title=\"Sneaker Configurator\" loading=\"lazy\"></iframe>";
  if (log) pushEvent("3d_stage_change", { stage: stage, label: STAGES[stage].short });
  applyState(false);
}

function mountColorRow(id, key, colors) {
  const host = document.getElementById(id);
  colors.forEach((color) => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.type = "button";
    button.style.setProperty("--swatch", color);
    button.setAttribute("aria-label", key + " " + color);
    button.addEventListener("click", () => {
      state[key] = color;
      applyState(true, "3d_color_change", { part: key, color: color });
    });
    host.appendChild(button);
  });
}

function createMaterials() {
  const fabricTexture = makeFabricTexture();
  const decalTexture = makeDecalTexture();
  const upper = new THREE.MeshPhysicalMaterial({ color: state.upper, roughness: 0.78, clearcoat: 0.04, sheen: 0.24, map: fabricTexture });
  const accent = new THREE.MeshPhysicalMaterial({ color: state.accent, roughness: 0.35, clearcoat: 0.16, metalness: 0.06 });
  const outsole = new THREE.MeshPhysicalMaterial({ color: state.outsole, roughness: 0.88, metalness: 0.01 });
  const laces = new THREE.MeshPhysicalMaterial({ color: state.laces, roughness: 0.72, clearcoat: 0.04 });
  const tongue = new THREE.MeshPhysicalMaterial({ color: state.upper, roughness: 0.68, clearcoat: 0.06, map: fabricTexture });
  const decal = new THREE.MeshBasicMaterial({ map: decalTexture, transparent: true });
  return { upper, accent, outsole, laces, tongue, decal, fabricTexture, decalTexture };
}

function buildShoe(materials) {
  const group = new THREE.Group();
  group.position.y = 0.5;

  const outsole = new THREE.Mesh(new RoundedBoxGeometry(4.5, 0.46, 1.85, 6, 0.14), materials.outsole);
  outsole.castShadow = true;
  outsole.receiveShadow = true;
  group.add(outsole);

  const midsole = new THREE.Mesh(new RoundedBoxGeometry(4.2, 0.42, 1.66, 6, 0.12), materials.accent);
  midsole.position.y = 0.28;
  midsole.castShadow = true;
  group.add(midsole);

  const upper = new THREE.Mesh(new RoundedBoxGeometry(3.9, 1.18, 1.42, 6, 0.22), materials.upper);
  upper.position.set(-0.1, 0.9, 0);
  upper.rotation.z = -0.08;
  upper.castShadow = true;
  group.add(upper);

  const toe = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.78, 1.34, 6, 0.24), materials.upper);
  toe.position.set(1.9, 0.74, 0);
  toe.rotation.z = -0.05;
  group.add(toe);

  const heel = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.18, 1.28, 6, 0.18), materials.accent);
  heel.position.set(-2.02, 0.88, 0);
  group.add(heel);

  const tongue = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.95, 0.54, 4, 0.1), materials.tongue);
  tongue.position.set(0.28, 1.28, 0);
  tongue.rotation.x = -0.32;
  group.add(tongue);

  const stripes = [];
  [-0.45, -0.05, 0.35].forEach((z) => {
    const stripe = new THREE.Mesh(new RoundedBoxGeometry(1.52, 0.1, 0.18, 3, 0.04), materials.accent);
    stripe.position.set(0.08, 0.95, z);
    stripe.rotation.z = -0.18;
    group.add(stripe);
    stripes.push(stripe);
  });

  const laceRows = [];
  for (let i = 0; i < 5; i += 1) {
    const row = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.08, 1.0, 2, 0.03), materials.laces);
    row.position.set(0.1 - i * 0.22, 1.08 + i * 0.03, 0);
    row.rotation.z = -0.12;
    group.add(row);
    laceRows.push(row);
  }

  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), materials.decal);
  decal.position.set(0.3, 1.5, 0);
  decal.rotation.x = -0.44;
  group.add(decal);

  const shadowPlane = new THREE.Mesh(
    new THREE.CircleGeometry(2.25, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.18;
  shadowPlane.scale.set(1.2, 0.58, 1);
  group.add(shadowPlane);

  return { group, outsole, midsole, upper, toe, heel, tongue, stripes, laceRows, decal, shadowPlane };
}

function makeFabricTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c7b29b";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(84, 57, 38, 0.24)";
  for (let x = 0; x < 256; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y < 256; y += 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function makeDecalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(17, 24, 39, 0.0)";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#f59e0b";
  ctx.font = "700 92px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TFZ", 128, 132);
  return new THREE.CanvasTexture(canvas);
}

function applyState(logChange = false, eventName = "", payload = {}) {
  materials.upper.color.set(state.upper);
  materials.accent.color.set(state.accent);
  materials.outsole.color.set(state.outsole);
  materials.laces.color.set(state.laces);
  materials.tongue.color.set(state.upper);

  const preset = materialPresets[state.material];
  materials.upper.roughness = preset.roughness;
  materials.upper.metalness = preset.metalness;
  materials.upper.clearcoat = preset.clearcoat;
  materials.upper.sheen = preset.sheen;
  materials.tongue.roughness = Math.max(0.32, preset.roughness - 0.08);
  materials.tongue.clearcoat = Math.max(0.02, preset.clearcoat * 0.75);

  applySilhouette();
  shoe.decal.visible = stage >= 5 && state.decal;
  refreshSwatchStates();
  syncUrl();
  notice.textContent = stage >= 10
    ? "Storefront handoff live: embed snippet, screenshot path, and AR route hooks all exist in one build."
    : "Stand-in sneaker asset included. Swap for licensed glTF before public launch.";
  if (logChange && eventName) pushEvent(eventName, payload);
}

function applySilhouette() {
  const preset = silhouettes[state.silhouette];
  shoe.upper.scale.set(preset.upperX, preset.upperY, preset.upperZ);
  shoe.toe.scale.z = preset.toeLength;
  shoe.heel.scale.y = preset.heelHeight;
  shoe.outsole.scale.y = preset.soleY;
  shoe.midsole.scale.y = preset.soleY;
  shoe.shadowPlane.scale.set(1.2 * preset.upperX, 0.58 * preset.upperZ, 1);
  if (state.silhouette === "court") { controls.target.set(0.15, 1.05, 0); }
  if (state.silhouette === "runner") { controls.target.set(0.2, 1.2, 0); }
  if (state.silhouette === "trail") { controls.target.set(0.1, 1.34, 0); }
  controls.update();
}

function applyPerformanceMode() {
  const dpr = state.lowPower ? 1 : Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  keyLight.castShadow = !state.lowPower;
  shoe.shadowPlane.visible = !state.lowPower;
  resize();
}

function refreshSwatchStates() {
  document.querySelectorAll(".swatch").forEach((button) => {
    const host = button.parentElement.id;
    const index = Array.from(button.parentElement.children).indexOf(button);
    const key = host.includes("upper") ? "upper" : host.includes("accent") ? "accent" : host.includes("outsole") ? "outsole" : "laces";
    const active = COLORS[key][index] === state[key];
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  document.getElementById("silhouette-select").value = state.silhouette;
  document.getElementById("material-select").value = state.material;
}

function resize() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function computePrice() {
  let total = 220;
  if (state.material === "suede") total += 35;
  if (state.material === "leather") total += 65;
  if (state.material === "gloss") total += 22;
  if (state.silhouette === "trail") total += 28;
  if (state.decal) total += 12;
  return total;
}

function exportState() {
  return {
    upper: state.upper,
    accent: state.accent,
    outsole: state.outsole,
    laces: state.laces,
    silhouette: state.silhouette,
    material: state.material,
    decal: state.decal,
    lowPower: state.lowPower,
  };
}

function hydrateFromUrl() {
  const raw = params.get("c");
  if (!raw) return;
  try {
    const next = JSON.parse(atob(raw));
    Object.assign(state, next);
  } catch (error) {
    console.warn("Could not hydrate shared state", error);
  }
}

function syncUrl() {
  params.set("stage", String(stage));
  params.set("c", btoa(JSON.stringify(exportState())));
  history.replaceState(null, "", "?" + params.toString());
}

async function copyShareUrl() {
  syncUrl();
  try {
    await navigator.clipboard.writeText(window.location.href);
    pushEvent("3d_share", { stage: stage, method: "clipboard" });
    notify("Share URL copied.");
  } catch (error) {
    notify("Clipboard unavailable; copy the address bar instead.");
  }
}

function randomize() {
  state.upper = pick(COLORS.upper);
  state.accent = pick(COLORS.accent);
  state.outsole = pick(COLORS.outsole);
  state.laces = pick(COLORS.laces);
  state.silhouette = pick(Object.keys(silhouettes));
  state.material = pick(Object.keys(materialPresets));
  state.decal = Math.random() > 0.35;
  applyState(true, "3d_randomize", { stage: stage });
}

function launchAR() {
  const platform = /iPhone|iPad|Mac/.test(navigator.userAgent)
    ? "ios-quick-look"
    : /Android/.test(navigator.userAgent)
      ? "android-scene-viewer"
      : "webxr-or-desktop-fallback";
  pushEvent("3d_ar_launch", { platform: platform, stage: stage });
  notify("AR route: " + platform + ". Wire your real USDZ / Scene Viewer assets here.");
}

function savePng() {
  renderer.render(scene, camera);
  const link = document.createElement("a");
  link.href = renderer.domElement.toDataURL("image/png");
  link.download = "sneaker-configurator-stage-" + String(stage).padStart(2, "0") + ".png";
  link.click();
  pushEvent("3d_photo_capture", { stage: stage, price: computePrice() });
}

function resetState() {
  state.upper = '#f97316';
  state.accent = '#111827';
  state.outsole = '#f8fafc';
  state.laces = '#f8fafc';
  state.silhouette = 'runner';
  state.material = 'mesh';
  state.decal = true;
  state.lowPower = false;
  state.autoRotate = !prefersReducedMotion;
  applyPerformanceMode();
  applyState(true, "3d_reset", { stage: stage });
}

function pushEvent(name, payload) {
  const price = computePrice();
  const line = "[" + new Date().toLocaleTimeString() + "] " + name + " " + JSON.stringify({ price: price, ...payload });
  logEl.textContent = line + "\n" + logEl.textContent;
  logEl.textContent = logEl.textContent.slice(0, 1800);
  updateStats();
}

function notify(message) {
  notice.textContent = message;
}

function updateStats() {
  statsEl.textContent = [
    "stage=" + stage + " · " + STAGES[stage].short,
    "price=$" + computePrice(),
    "dpr=" + renderer.getPixelRatio().toFixed(2),
    "calls=" + renderer.info.render.calls,
    "tris=" + renderer.info.render.triangles,
    "lowPower=" + state.lowPower,
  ].join("\n");
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}