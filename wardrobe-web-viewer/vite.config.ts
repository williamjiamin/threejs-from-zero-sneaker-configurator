import { defineConfig } from "vite";

// The game export is staged into public/game at build time, never maintained
// as a second committed asset set in this viewer.
export default defineConfig({
  base: "./",
  build: { target: "es2022", sourcemap: false, emptyOutDir: true },
  server: { host: "127.0.0.1", strictPort: true },
  preview: { host: "127.0.0.1" }
});
