/** Only game-relative static asset paths are allowed. Never fetch remote content. */
export function assertRelativeAssetPath(path: unknown): asserts path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > 240) {
    throw new Error("Invalid asset path");
  }
  if (path.startsWith("/") || path.startsWith("\\") || path.includes("\\") ||
      path.includes("?") || path.includes("#") || path.includes(":") ||
      path.includes("%") || /[\u0000-\u001f\u007f]/.test(path)) {
    throw new Error("Asset path must be a plain relative game path");
  }
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) {
    throw new Error("Asset path traversal or hidden segments are forbidden");
  }
  if (!parts.every((part) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part))) {
    throw new Error("Unsupported asset path characters");
  }
}

export function assetUrl(path: string, gameBase: string): string {
  assertRelativeAssetPath(path);
  const base = new URL(gameBase, "http://localhost/");
  if (base.protocol !== "http:" && base.protocol !== "https:") throw new Error("Bad game base");
  if (!base.pathname.endsWith("/")) throw new Error("Game base must end with slash");
  // All paths are already validated and can only resolve inside this base.
  return new URL(path, base).href;
}
