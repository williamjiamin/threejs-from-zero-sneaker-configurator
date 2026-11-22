/** Sidecar feature flag. The game runtime has no patch or registration. */
export const FEATURE_ID = "wardrobe_web_viewer_01" as const;

type Env = Record<string, unknown>;

function truthySwitch(value: unknown): boolean {
  return value === true || value === 1 ||
    (typeof value === "string" && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase()));
}

function explicitlyFalse(value: unknown): boolean {
  return value === false || value === 0 ||
    (typeof value === "string" && ["0", "false", "no", "off"].includes(value.trim().toLowerCase()));
}

export function enabled(env: Env = import.meta.env): boolean {
  // The OFF switch always overrides every other setting.
  if (truthySwitch(env.VITE_FA09_OFF) || truthySwitch(env.VITE_WARDROBE_VIEWER_OFF)) return false;
  const setting = env.VITE_WARDROBE_VIEWER_ENABLED;
  // Absent project settings must never disable the feature.
  return setting === undefined || setting === null || setting === "" || !explicitlyFalse(setting);
}
