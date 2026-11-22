import { describe, expect, it } from "vitest";
import { enabled, FEATURE_ID } from "../src/featureFlags.ts";

describe("kill switch and default enabled", () => {
  it("ships enabled even with no project setting", () => {
    expect(enabled({})).toBe(true);
    expect(FEATURE_ID).toBe("wardrobe_web_viewer_01");
  });
  it("honors explicit setting but kill switch always wins", () => {
    expect(enabled({ VITE_WARDROBE_VIEWER_ENABLED: "false" })).toBe(false);
    expect(enabled({ VITE_WARDROBE_VIEWER_ENABLED: "true", VITE_FA09_OFF: "1" })).toBe(false);
    expect(enabled({ VITE_WARDROBE_VIEWER_ENABLED: true, VITE_WARDROBE_VIEWER_OFF: "yes" })).toBe(false);
    expect(enabled({ VITE_FA09_OFF: "0" })).toBe(true);
  });
});
