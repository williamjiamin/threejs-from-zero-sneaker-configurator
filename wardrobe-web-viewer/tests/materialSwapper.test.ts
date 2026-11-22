import { expect, it } from "vitest";
import { BoxGeometry, Mesh, MeshStandardMaterial, Object3D } from "three";
import { MaterialSwapper } from "../src/materialSwapper.ts";
import type { Colorway, MaterialSlot } from "../src/manifest.ts";

it("changes only selected material slots and restores exactly the original references", () => {
  const root = new Object3D();
  const original = new MeshStandardMaterial({color:"#ffffff", roughness:0.9});
  original.name = "fabric";
  const untouched = new MeshStandardMaterial({color:"#e1e1e1"});
  untouched.name = "unmapped";
  const a = new Mesh(new BoxGeometry(1, 1, 1), original);
  const b = new Mesh(new BoxGeometry(1, 1, 1), untouched);
  root.add(a, b);
  const slots: MaterialSlot[] = [{id:"fabric", match_material:"fabric"}];
  const variant: Colorway = {id:"one",name:"One",swatch:"#112233", materials: {
    fabric: {color:"#112233",roughness:0.3,metalness:0.2}
  }};
  const swapper = new MaterialSwapper(root);
  expect(swapper.apply(variant, slots)).toBe(1);
  expect(a.material).not.toBe(original);
  expect((a.material as MeshStandardMaterial).color.getHexString()).toBe("112233");
  expect(b.material).toBe(untouched);
  expect(original.color.getHexString()).toBe("ffffff");
  swapper.dispose();
  expect(a.material).toBe(original);
  expect(b.material).toBe(untouched);
  a.geometry.dispose(); b.geometry.dispose(); original.dispose(); untouched.dispose();
});
