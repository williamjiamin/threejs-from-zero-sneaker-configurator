import { enabled } from "./featureFlags.ts";

// OFF = identical empty legacy mount: no CSS import, DOM edits, fetch or WebGL.
// This sidecar never patches the original application or game runtime.
if (enabled()) {
  void import("./app.ts").then(({ mountWardrobe }) => {
    const root = document.querySelector<HTMLElement>("#app");
    if (root) mountWardrobe(root);
  }).catch((error: unknown) => {
    console.error("Wardrobe viewer could not start", error);
  });
}
