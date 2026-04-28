import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const deployUrl = 'https://threejs-from-zero-sneaker-configurator.pages.dev/';

const STAGES = {
  1: { short: 'Scene scaffold', copy: 'Bootstrap the viewer shell, lighting, and the course hero sneaker asset.' },
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
camera.position.set(5.1, 1.7, 7.15);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 11;
controls.target.set(0.18, 1.02, 0);
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

const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(2.58, 2.88, 0.56, 56),
  new THREE.MeshPhysicalMaterial({
    color: 0x160d08,
    roughness: 0.28,
    metalness: 0.1,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
  })
);
pedestal.position.y = 0.1;
pedestal.receiveShadow = true;
scene.add(pedestal);

const halo = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeHaloTexture(),
    color: 0xfdba74,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
halo.position.set(-0.15, 2.15, -1.7);
halo.scale.set(7.8, 5.2, 1);
scene.add(halo);

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
  embedSnippet.textContent = `<iframe src="${deployUrl}" title="Sneaker Configurator" loading="lazy"></iframe>`;
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
  const upper = new THREE.MeshPhysicalMaterial({
    color: state.upper,
    roughness: 0.78,
    clearcoat: 0.04,
    sheen: 0.24,
    map: fabricTexture,
    bumpMap: fabricTexture,
    bumpScale: 0.03,
  });
  const accent = new THREE.MeshPhysicalMaterial({ color: state.accent, roughness: 0.35, clearcoat: 0.16, metalness: 0.06 });
  const outsole = new THREE.MeshPhysicalMaterial({ color: state.outsole, roughness: 0.88, metalness: 0.01 });
  const laces = new THREE.MeshPhysicalMaterial({ color: state.laces, roughness: 0.72, clearcoat: 0.04 });
  const tongue = new THREE.MeshPhysicalMaterial({
    color: state.upper,
    roughness: 0.68,
    clearcoat: 0.06,
    map: fabricTexture,
    bumpMap: fabricTexture,
    bumpScale: 0.02,
  });
  const decal = new THREE.MeshBasicMaterial({ map: decalTexture, transparent: true });
  return { upper, accent, outsole, laces, tongue, decal, fabricTexture, decalTexture };
}

function buildShoe(materials) {
  const group = new THREE.Group();
  group.position.set(0, 0.24, 0);
  group.rotation.y = -0.34;

  const outsole = makeExtrudedPart([
    [-2.5, 0.0], [-2.18, 0.1], [-1.18, 0.18], [0.08, 0.22], [1.32, 0.28], [2.1, 0.38],
    [2.52, 0.58], [2.45, 0.8], [1.72, 0.84], [0.36, 0.8], [-1.22, 0.72], [-2.18, 0.54], [-2.5, 0.26],
  ], 1.92, materials.outsole, { bevelSize: 0.06, bevelThickness: 0.08 });
  group.add(outsole);

  const midsole = makeExtrudedPart([
    [-2.16, 0.26], [-1.92, 0.4], [-1.0, 0.48], [0.02, 0.54], [1.12, 0.62], [1.9, 0.76],
    [2.18, 0.92], [2.04, 1.05], [1.28, 1.0], [0.14, 0.95], [-1.24, 0.88], [-2.04, 0.72], [-2.24, 0.48],
  ], 1.7, materials.accent, { bevelSize: 0.05, bevelThickness: 0.07 });
  midsole.position.y = 0.06;
  group.add(midsole);

  const upper = makeExtrudedPart([
    [-1.98, 0.74], [-1.72, 1.22], [-1.12, 1.62], [-0.3, 1.86], [0.54, 1.92], [1.28, 1.74],
    [1.92, 1.28], [2.18, 0.96], [1.98, 0.84], [1.32, 0.82], [0.42, 0.88], [-0.54, 0.96], [-1.36, 0.98], [-1.92, 0.86],
  ], 1.44, materials.upper, {
    bevelSize: 0.08,
    bevelThickness: 0.08,
    holes: [[
      [-0.82, 1.16], [-0.52, 1.44], [-0.02, 1.56], [0.48, 1.48], [0.72, 1.22], [0.22, 1.16], [-0.18, 1.12], [-0.62, 1.12],
    ]],
  });
  upper.position.set(-0.08, 0.02, 0);
  group.add(upper);

  const liner = makeExtrudedPart([
    [-1.72, 0.92], [-1.42, 1.26], [-0.88, 1.48], [-0.18, 1.56], [0.48, 1.48], [1.08, 1.26],
    [1.62, 0.98], [1.36, 0.92], [0.66, 0.92], [-0.1, 0.96], [-0.88, 1.0], [-1.52, 0.98],
  ], 1.04, new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    roughness: 0.92,
    clearcoat: 0.02,
  }), {
    bevelSize: 0.03,
    bevelThickness: 0.04,
    holes: [[
      [-0.56, 1.14], [-0.28, 1.34], [0.0, 1.42], [0.28, 1.36], [0.44, 1.18], [0.02, 1.14], [-0.28, 1.12],
    ]],
  });
  liner.position.set(-0.04, 0.08, 0);
  group.add(liner);

  const toe = makeExtrudedPart([
    [1.06, 0.82], [1.6, 0.9], [2.02, 1.06], [2.18, 0.9], [1.9, 0.72], [1.28, 0.68],
  ], 1.48, materials.upper, { bevelSize: 0.05, bevelThickness: 0.05 });
  toe.position.set(0.08, 0.02, 0);
  group.add(toe);

  const heel = makeExtrudedPart([
    [-2.08, 0.84], [-1.92, 1.42], [-1.5, 1.66], [-1.36, 1.0], [-1.7, 0.72],
  ], 1.28, materials.accent, { bevelSize: 0.04, bevelThickness: 0.05 });
  heel.position.set(-0.06, 0.02, 0);
  group.add(heel);

  const tongue = makeExtrudedPart([
    [-0.48, 0.0], [-0.22, 0.62], [0.22, 0.94], [0.56, 0.9], [0.78, 0.34], [0.4, -0.02],
  ], 0.56, materials.tongue, { bevelSize: 0.03, bevelThickness: 0.04 });
  tongue.position.set(0.1, 1.0, 0);
  tongue.rotation.x = -0.42;
  group.add(tongue);

  const stripes = [];
  const stripeProfiles = [
    [[-0.56, 0.0], [0.22, 0.02], [0.76, 0.18], [0.62, 0.36], [0.0, 0.28], [-0.64, 0.18]],
    [[-0.52, 0.0], [0.32, 0.04], [0.86, 0.18], [0.74, 0.36], [0.08, 0.28], [-0.6, 0.18]],
    [[-0.44, 0.0], [0.34, 0.06], [0.86, 0.22], [0.72, 0.4], [0.14, 0.3], [-0.5, 0.18]],
  ];
  stripeProfiles.forEach((profile, index) => {
    const stripe = makeExtrudedPart(profile, 0.1, materials.accent, { bevelSize: 0.02, bevelThickness: 0.02 });
    stripe.position.set(0.18 - index * 0.02, 1.0 + index * 0.14, 0.73);
    stripe.rotation.z = -0.28;
    group.add(stripe);
    stripes.push(stripe);
  });

  const laceRows = [];
  for (let i = 0; i < 6; i += 1) {
    const row = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.68, 4, 10), materials.laces);
    row.position.set(0.26 - i * 0.28, 1.12 + i * 0.06, 0);
    row.rotation.z = Math.PI / 2;
    row.rotation.y = 0.12;
    row.castShadow = true;
    group.add(row);
    laceRows.push(row);
  }

  const eyelets = [];
  for (let i = 0; i < 6; i += 1) {
    [-0.34, 0.34].forEach((z) => {
      const eyelet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12),
        materials.accent,
      );
      eyelet.rotation.x = Math.PI / 2;
      eyelet.position.set(0.12 - i * 0.28, 1.03 + i * 0.06, z);
      eyelet.castShadow = true;
      group.add(eyelet);
      eyelets.push(eyelet);
    });
  }

  const treadBlocks = [];
  for (let i = 0; i < 7; i += 1) {
    const tread = new THREE.Mesh(
      new RoundedBoxGeometry(0.34, 0.08, 0.46, 2, 0.02),
      materials.outsole,
    );
    tread.position.set(-1.78 + i * 0.56, -0.03, i % 2 === 0 ? 0.32 : -0.32);
    tread.castShadow = true;
    group.add(tread);
    treadBlocks.push(tread);
  }

  const heelLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.035, 12, 42, Math.PI),
    materials.accent,
  );
  heelLoop.rotation.set(Math.PI / 2, 0, 0);
  heelLoop.position.set(-1.86, 1.68, 0);
  group.add(heelLoop);

  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.46), materials.decal);
  decal.position.set(0.18, 1.5, 0.18);
  decal.rotation.x = -0.48;
  group.add(decal);

  const shadowPlane = new THREE.Mesh(
    new THREE.CircleGeometry(2.25, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.04;
  shadowPlane.scale.set(1.15, 0.56, 1);
  group.add(shadowPlane);

  return { group, outsole, midsole, upper, liner, toe, heel, tongue, stripes, laceRows, eyelets, treadBlocks, heelLoop, decal, shadowPlane };
}

function makePath(points, Target = THREE.Shape) {
  const shape = new Target();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function makeExtrudedPart(points, depth, material, options = {}) {
  const shape = makePath(points);
  (options.holes ?? []).forEach((holePoints) => {
    shape.holes.push(makePath(holePoints, THREE.Path));
  });
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 4,
    curveSegments: 28,
    bevelSize: options.bevelSize ?? 0.04,
    bevelThickness: options.bevelThickness ?? 0.05,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeHaloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 14, 128, 128, 118);
  gradient.addColorStop(0, 'rgba(255, 247, 237, 1)');
  gradient.addColorStop(0.18, 'rgba(253, 186, 116, 0.95)');
  gradient.addColorStop(0.45, 'rgba(249, 115, 22, 0.42)');
  gradient.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function makeFabricTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, "#e8dccb");
  gradient.addColorStop(0.55, "#c9b39b");
  gradient.addColorStop(1, "#9f7d63");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(74, 52, 37, 0.18)";
  ctx.lineWidth = 2;
  for (let x = -24; x < 280; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 72, 256);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 245, 235, 0.1)";
  ctx.lineWidth = 1.5;
  for (let x = 18; x < 320; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 72, 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.6, 1.6);
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
    : "Custom hero sneaker included. Swap to a brand-specific glTF only when exact merchandising geometry matters.";
  if (logChange && eventName) pushEvent(eventName, payload);
}

function applySilhouette() {
  const preset = silhouettes[state.silhouette];
  shoe.upper.scale.set(preset.upperX, preset.upperY, preset.upperZ);
  shoe.liner.scale.set(Math.max(0.96, preset.upperX * 0.98), preset.upperY, Math.max(0.92, preset.upperZ * 0.94));
  shoe.toe.scale.set(preset.toeLength, preset.upperY, preset.upperZ);
  shoe.heel.scale.set(Math.max(0.92, preset.upperX * 0.96), preset.heelHeight, preset.upperZ);
  shoe.tongue.scale.set(Math.max(0.94, preset.upperX * 0.96), preset.upperY, 1);
  shoe.outsole.scale.set(preset.upperX * 1.02, preset.soleY, preset.upperZ);
  shoe.midsole.scale.set(preset.upperX, preset.soleY, Math.max(0.92, preset.upperZ * 0.98));
  shoe.stripes.forEach((stripe) => {
    stripe.scale.set(Math.max(0.96, preset.upperX), preset.upperY, 1);
  });
  shoe.laceRows.forEach((row) => {
    row.scale.set(1, 1, Math.max(0.92, preset.upperZ));
  });
  shoe.shadowPlane.scale.set(1.2 * preset.upperX, 0.58 * preset.upperZ, 1);
  if (state.silhouette === "court") { controls.target.set(0.14, 0.92, 0); }
  if (state.silhouette === "runner") { controls.target.set(0.18, 1.02, 0); }
  if (state.silhouette === "trail") { controls.target.set(0.08, 1.16, 0); }
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
