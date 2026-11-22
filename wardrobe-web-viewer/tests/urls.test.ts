import { describe, expect, it } from "vitest";
import { assetUrl, assertRelativeAssetPath } from "../src/assetUrl.ts";

describe("local-only asset paths", () => {
  it("resolves local models against a specific static root", () => {
    expect(assetUrl("assets/garments/field_coat.glb", "http://127.0.0.1:4000/game/"))
      .toBe("http://127.0.0.1:4000/game/assets/garments/field_coat.glb");
  });
  it.each(["../escape.glb", "/absolute.glb", "https://external.invalid/x.glb",
    "assets/%2e%2e/file.glb", "assets\\file.glb", "a//file.glb", "./hidden"])(
    "rejects %s", (path) => expect(() => assertRelativeAssetPath(path)).toThrow()
  );
});
