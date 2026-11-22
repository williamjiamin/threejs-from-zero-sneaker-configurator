import { expect, it } from "vitest";
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import { heightMetres, scaleReadout } from "../src/scale.ts";

it("reports measured geometry height with exactly three decimals", () => {
  const mesh = new Mesh(new BoxGeometry(0.7, 1.68, 0.25), new MeshStandardMaterial());
  const height = heightMetres(mesh);
  expect(Math.abs(height - 1.68)).toBeLessThan(1e-6);
  expect(scaleReadout(height)).toBe("1.680 m");
  mesh.geometry.dispose();
  mesh.material.dispose();
});
