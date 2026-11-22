import { Box3, Object3D, Vector3 } from "three";

/** Read the model's actual world-space vertical extent in metres. */
export function heightMetres(model: Object3D): number {
  model.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(model);
  if (box.isEmpty()) throw new Error("GLB contains no visible geometry");
  const height = box.getSize(new Vector3()).y;
  if (!Number.isFinite(height) || height <= 0) throw new Error("Invalid GLB height");
  return height;
}

export function scaleReadout(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) throw new Error("Invalid model scale");
  return `${metres.toFixed(3)} m`;
}
