import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8090 },
  plugins: [react()],
  build: { target: "esnext", sourcemap: false },
  esbuild: { drop: mode === "production" ? ["console", "debugger"] : [] },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
