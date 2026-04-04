import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:4175",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4174,
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: apiProxy,
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
    proxy: apiProxy,
  },
});
