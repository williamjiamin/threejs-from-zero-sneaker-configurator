import "./style.css";
import { assetUrl } from "./assetUrl.ts";
import { parseCatalog, parseGarmentDef, type GarmentDef } from "./manifest.ts";
import { scaleReadout } from "./scale.ts";
import { WardrobeViewport } from "./viewer.ts";

const GAME_BASE = new URL(`${import.meta.env.BASE_URL}game/`, document.baseURI).href;
const EXPECTED_HEIGHT_TOLERANCE_M = 0.002;

async function jsonAt(path: string): Promise<unknown> {
  const response = await fetch(assetUrl(path, GAME_BASE), {
    credentials: "same-origin", redirect: "error", cache: "no-store"
  });
  if (!response.ok) throw new Error(`Local asset unavailable (${response.status}): ${path}`);
  return response.json() as Promise<unknown>;
}

function button(label: string, className: string, pressed: boolean, click: () => void): HTMLButtonElement {
  const result = document.createElement("button");
  result.type = "button";
  result.className = className;
  result.textContent = label;
  result.setAttribute("aria-pressed", String(pressed));
  result.addEventListener("click", click);
  return result;
}

export async function mountWardrobe(root: HTMLElement): Promise<void> {
  // Constant markup only. All manifest labels use textContent, never innerHTML.
  root.innerHTML = `
    <main class="shell">
      <header class="topbar"><div class="wordmark">WARDROBE <span>STUDIO</span></div>
        <div class="privacy">PRIVATE LOCAL PREVIEW · NO UPLOADS</div></header>
      <div class="layout">
        <section class="preview-card" aria-label="Garment model viewport">
          <div class="preview-heading"><span>INTERACTIVE 3D PREVIEW</span><span>DRAG TO ROTATE · SCROLL TO ZOOM</span></div>
          <div class="canvas-host" id="canvas-host"></div>
          <div class="preview-footer"><span>Y UP · METRES</span><span id="scale">HEIGHT: ...</span></div>
        </section>
        <section class="config-card" aria-label="Garment configuration">
          <div class="eyebrow">GARMENT CONFIGURATOR / 01</div>
          <h1>Explore the collection.</h1>
          <p class="intro">Local game-definition assets. Materials can be viewed in three colorways per garment.</p>
          <div class="rule"></div>
          <h2>01 <span>Choose garment</span></h2>
          <div class="selection-grid" id="garments" role="group" aria-label="Garment options"></div>
          <h2>02 <span>Choose colorway</span></h2>
          <div class="selection-grid colors" id="colors" role="group" aria-label="Colorway options"></div>
          <p class="description" id="description"></p>
          <div class="specs"><span>MEASURED MODEL HEIGHT</span><strong id="spec-height">...</strong></div>
          <p class="status" id="status" role="status" aria-live="polite">Loading local game definitions…</p>
        </section>
      </div>
      <footer class="footnote">LOCAL STATIC DRAFT · NO TELEMETRY · MATERIALS REMAIN IN YOUR BROWSER</footer>
    </main>`;

  const host = root.querySelector<HTMLElement>("#canvas-host")!;
  const garmentButtons = root.querySelector<HTMLElement>("#garments")!;
  const colorButtons = root.querySelector<HTMLElement>("#colors")!;
  const description = root.querySelector<HTMLElement>("#description")!;
  const status = root.querySelector<HTMLElement>("#status")!;
  const scale = root.querySelector<HTMLElement>("#scale")!;
  const specHeight = root.querySelector<HTMLElement>("#spec-height")!;

  let viewport: WardrobeViewport | null = null;
  let defs: GarmentDef[] = [];
  let active = 0;
  let color = 0;
  let selectionToken = 0;
  const setStatus = (message: string, failed = false): void => {
    status.textContent = message;
    status.classList.toggle("error", failed);
  };

  function showColors(): void {
    colorButtons.replaceChildren();
    const def = defs[active];
    for (const [i, colorway] of def.colorways.entries()) {
      const selector = button(colorway.name, "color-choice", i === color, () => {
        color = i;
        showColors();
        const matched = viewport?.recolor(def, colorway) ?? 0;
        if (matched > 0) setStatus(`${def.name} · ${colorway.name} · ${matched} local material bindings`);
      });
      const chip = document.createElement("span");
      chip.className = "swatch";
      chip.style.backgroundColor = colorway.swatch;
      chip.setAttribute("aria-hidden", "true");
      selector.prepend(chip);
      colorButtons.append(selector);
    }
  }

  function showGarments(): void {
    garmentButtons.replaceChildren();
    for (const [i, def] of defs.entries()) {
      garmentButtons.append(button(def.name, "garment-choice", i === active, () => {
        if (active !== i) { active = i; color = 0; void loadSelected(); }
      }));
    }
  }

  async function loadSelected(): Promise<void> {
    if (!viewport) return;
    const token = ++selectionToken;
    const def = defs[active];
    showGarments();
    showColors();
    description.textContent = def.description;
    setStatus(`Loading ${def.name}…`);
    try {
      const result = await viewport.load(def, def.colorways[color]);
      if (!result || token !== selectionToken) return;
      // The user may have picked another color while the GLB was loading.
      const matched = viewport.recolor(def, def.colorways[color]);
      const readout = scaleReadout(result.height);
      scale.textContent = `HEIGHT: ${readout}`;
      specHeight.textContent = readout;
      const error = Math.abs(result.height - def.model.expected_height_m);
      if (error > EXPECTED_HEIGHT_TOLERANCE_M) {
        setStatus(`Model height ${readout} differs from the game definition.`, true);
      } else if (matched < def.material_slots.length) {
        setStatus(`Material slots missing in the GLB (${matched}/${def.material_slots.length}).`, true);
      } else {
        setStatus(`${def.name} · ${def.colorways[color].name} · ${matched} material bindings ready`);
      }
    } catch (reason: unknown) {
      if (token !== selectionToken) return;
      const detail = reason instanceof Error ? reason.message : "Unexpected local asset failure";
      setStatus(detail, true);
    }
  }

  try {
    const catalog = parseCatalog(await jsonAt("data/garment_defs/catalog.json"));
    defs = await Promise.all(catalog.garment_defs.map(async (path) => parseGarmentDef(await jsonAt(path))));
    if (new Set(defs.map((def) => def.id)).size !== defs.length) throw new Error("Duplicate garment IDs");
    viewport = new WardrobeViewport(host, GAME_BASE);
    await loadSelected();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to open local garment definitions";
    setStatus(message, true);
  }

  // One page lifecycle; dispose GPU resources on exit.
  window.addEventListener("pagehide", () => { viewport?.dispose(); }, { once: true });
}
