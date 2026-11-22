import { Material, Mesh, MeshStandardMaterial, Object3D } from "three";
import type { Colorway, MaterialSlot } from "./manifest.ts";

type GarmentMesh = Mesh & { material: Material | Material[] };

/**
 * Original glTF materials are retained and never mutated. Every replacement is
 * disposed when the colorway changes or this viewer is disposed.
 */
export class MaterialSwapper {
  private originals = new Map<GarmentMesh, Material | Material[]>();
  private temporary = new Set<Material>();

  constructor(root: Object3D) {
    root.traverse((object) => {
      if ((object as Mesh).isMesh) {
        const mesh = object as GarmentMesh;
        this.originals.set(mesh, mesh.material);
      }
    });
  }

  apply(colorway: Colorway, slots: MaterialSlot[]): number {
    this.reset();
    const byName = new Map(slots.map((slot) => [slot.match_material, slot.id]));
    let replaced = 0;
    for (const [mesh, original] of this.originals) {
      const change = (material: Material): Material => {
        const slot = byName.get(material.name);
        if (!slot) return material;
        const preset = colorway.materials[slot];
        if (!preset) return material;
        if (!(material instanceof MeshStandardMaterial)) return material;
        const candidate = material.clone();
        candidate.color.set(preset.color);
        candidate.roughness = preset.roughness;
        candidate.metalness = preset.metalness;
        candidate.needsUpdate = true;
        this.temporary.add(candidate);
        replaced++;
        return candidate;
      };
      mesh.material = Array.isArray(original) ? original.map(change) : change(original);
    }
    return replaced;
  }

  reset(): void {
    for (const [mesh, original] of this.originals) mesh.material = original;
    for (const material of this.temporary) material.dispose();
    this.temporary.clear();
  }

  dispose(): void {
    this.reset();
    this.originals.clear();
  }
}
