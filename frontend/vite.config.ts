import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Sin API_PROXY_TARGET, /api va al backend local. Con él, a una API remota; API_PROXY_ORIGIN
  // reemplaza la cabecera Origin para que pase la comprobación de FRONTEND_ORIGIN del backend.
  const env = loadEnv(mode, __dirname, "API_PROXY_");
  const remote = env.API_PROXY_TARGET;
  const proxy = remote
    ? { target: remote, changeOrigin: true, secure: true, headers: env.API_PROXY_ORIGIN ? { origin: env.API_PROXY_ORIGIN } : undefined }
    : { target: "http://127.0.0.1:3000", changeOrigin: false };
  return {
    server: { host: "::", port: 8090, proxy: { "/api": proxy } },
    plugins: [react()],
    build: { target: "esnext", sourcemap: false },
    esbuild: { drop: mode === "production" ? ["console", "debugger"] : [] },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
