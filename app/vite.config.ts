import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devHost = "localhost";

const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:4175",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: devHost,
    port: 4174,
    strictPort: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: apiProxy,
  },
  preview: {
    host: devHost,
    port: 4174,
    strictPort: true,
    proxy: apiProxy,
  },
});
