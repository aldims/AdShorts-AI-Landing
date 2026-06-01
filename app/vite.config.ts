import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devHost = "127.0.0.1";
const authHost = process.env.AUTH_SERVER_HOST || "127.0.0.1";
const authPort = Number(process.env.AUTH_SERVER_PORT || 4175);
const appRoot = path.dirname(fileURLToPath(import.meta.url));
const shouldAutoStartAuthBackend = process.env.ADSHORTS_AUTO_AUTH_BACKEND !== "0";

const isAuthBackendListening = () =>
  new Promise<boolean>((resolve) => {
    const socket = net.createConnection({
      host: authHost,
      port: authPort,
    });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });

const ensureAuthBackend = async () => {
  if (!shouldAutoStartAuthBackend || (await isAuthBackendListening())) {
    return;
  }

  console.info(`[vite] Auth backend is not listening on ${authHost}:${authPort}; starting it now.`);
  const result = spawnSync(process.execPath, [path.join(appRoot, "scripts/start-auth-dev-server.mjs")], {
    cwd: appRoot,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to start auth backend on ${authHost}:${authPort}.`);
  }

  if (!(await isAuthBackendListening())) {
    throw new Error(`Auth backend did not start on ${authHost}:${authPort}.`);
  }
};

const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:4175",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [
    {
      name: "adshorts-ensure-auth-backend",
      configureServer: ensureAuthBackend,
      configurePreviewServer: ensureAuthBackend,
    },
    react(),
  ],
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
  build: {
    // The studio is route-level lazy-loaded; keep the limit close to the current
    // production chunk so future growth still fails visibly in build output.
    chunkSizeWarningLimit: 850,
  },
});
