import {
  AmbientLight, Box3, CircleGeometry, Color, DirectionalLight,
  Group, HemisphereLight, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Scene, Vector3, WebGLRenderer,
  type Material, type Object3D
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { assetUrl } from "./assetUrl.ts";
import { MaterialSwapper } from "./materialSwapper.ts";
import { heightMetres } from "./scale.ts";
import type { Colorway, GarmentDef } from "./manifest.ts";

/** Dispose imported graphics after a switch, never disposing shared stage assets. */
function disposeImported(root: Object3D): void {
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<Material>();
  root.traverse((obj) => {
    if ((obj as Mesh).isMesh) {
      const mesh = obj as Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const all = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const item of all) if (item) materials.add(item);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export class WardrobeViewport {
  private scene = new Scene();
  private camera = new PerspectiveCamera(38, 1, 0.02, 100);
  private renderer: WebGLRenderer;
  private controls: OrbitControls;
  private loader = new GLTFLoader();
  private garment: Group | null = null;
  private swapper: MaterialSwapper | null = null;
  private definition: GarmentDef | null = null;
  private revision = 0;
  private resizeObserver: ResizeObserver;
  private floor: Mesh;

  constructor(private host: HTMLElement, private gameBase: string) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(new Color("#111b29"));
    this.renderer.domElement.setAttribute("aria-label", "Interactive garment preview");
    this.renderer.domElement.setAttribute("role", "img");
    this.host.appendChild(this.renderer.domElement);
    this.scene.background = new Color("#111b29");
    this.scene.add(new HemisphereLight("#f8f9fc", "#3c4b5a", 2.4));
    this.scene.add(new AmbientLight("#ffffff", 0.25));
    const key = new DirectionalLight("#fff1df", 2.1);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new DirectionalLight("#aacdff", 1.2);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);

    const platformMat = new MeshStandardMaterial({ color: "#28384b", roughness: 0.91 });
    this.floor = new Mesh(new CircleGeometry(1.2, 64), platformMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.012;
    this.scene.add(this.floor);

    this.camera.position.set(2.5, 1.8, 3.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.7;
    this.controls.maxDistance = 8;
    this.controls.maxPolarAngle = Math.PI * 0.76;
    this.controls.target.set(0, 0.85, 0);
    this.controls.update();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
    // No objects or collections are created in this hot path.
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private removeGarment(): void {
    if (!this.garment) return;
    this.swapper?.dispose();
    this.swapper = null;
    this.scene.remove(this.garment);
    disposeImported(this.garment);
    this.garment = null;
    this.definition = null;
  }

  /** Returns null when a newer user selection has superseded this load. */
  async load(def: GarmentDef, colorway: Colorway): Promise<{ height: number; matched: number } | null> {
    const myRevision = ++this.revision;
    const url = assetUrl(def.model.glb, this.gameBase);
    const gltf = await this.loader.loadAsync(url);
    if (myRevision !== this.revision) {
      disposeImported(gltf.scene);
      return null;
    }
    const incoming = gltf.scene;
    const height = heightMetres(incoming);
    const box = new Box3().setFromObject(incoming);
    const midpoint = box.getCenter(new Vector3());
    incoming.position.sub(new Vector3(midpoint.x, box.min.y, midpoint.z));
    incoming.updateMatrixWorld(true);
    this.removeGarment();
    this.garment = incoming;
    this.scene.add(incoming);
    this.definition = def;
    this.swapper = new MaterialSwapper(incoming);
    const matched = this.swapper.apply(colorway, def.material_slots);
    const size = new Vector3();
    new Box3().setFromObject(incoming).getSize(size);
    const span = Math.max(size.x, size.y, size.z);
    this.controls.target.set(0, height * 0.5, 0);
    this.camera.position.set(span * 1.30, height * 0.62, span * 1.88);
    this.controls.minDistance = Math.max(0.7, span * 0.85);
    this.controls.maxDistance = Math.max(5, span * 4.0);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    return { height, matched };
  }

  /** Apply without a re-download; original materials stay intact. */
  recolor(def: GarmentDef, colorway: Colorway): number {
    if (this.definition?.id !== def.id || !this.swapper) return 0;
    return this.swapper.apply(colorway, def.material_slots);
  }

  dispose(): void {
    ++this.revision;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.removeGarment();
    this.floor.geometry.dispose();
    (this.floor.material as MeshStandardMaterial).dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
