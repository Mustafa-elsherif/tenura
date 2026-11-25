import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path for GitHub Pages project site: https://<user>.github.io/tenura/
// Override with VITE_BASE for other hosts (e.g. "/" at a custom domain).
export default defineConfig({
  base: process.env.VITE_BASE ?? "/tenura/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
});
