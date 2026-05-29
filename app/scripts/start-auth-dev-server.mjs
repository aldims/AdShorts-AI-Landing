import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const runtimeDir = path.join(appRoot, "logs", "runtime");
const host = process.env.AUTH_SERVER_HOST || "127.0.0.1";
const port = Number(process.env.AUTH_SERVER_PORT || 4175);
const screenSession = process.env.AUTH_SERVER_SCREEN_SESSION || "adshorts-auth";
const logFile = path.join(runtimeDir, "auth-dev-server.screen.log");
const pidFile = path.join(runtimeDir, "auth-dev-server.pid");

mkdirSync(runtimeDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isPortOpen = () =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
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

const waitForPort = async () => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isPortOpen()) return true;
    await sleep(500);
  }

  return false;
};

const hasCommand = (command) =>
  spawnSync("sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore",
  }).status === 0;

const quoteForShell = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

const startWithScreen = () => {
  spawnSync("screen", ["-S", screenSession, "-X", "quit"], {
    stdio: "ignore",
  });

  const shellCommand = [
    `cd ${quoteForShell(appRoot)}`,
    `exec npm run dev:server >> ${quoteForShell(logFile)} 2>&1`,
  ].join(" && ");

  const result = spawnSync("screen", ["-dmS", screenSession, "sh", "-lc", shellCommand], {
    cwd: appRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to start screen session ${screenSession}.`);
  }
};

const startDetached = () => {
  const output = createWriteStream(logFile, { flags: "a" });
  const child = spawn("npm", ["run", "dev:server"], {
    cwd: appRoot,
    detached: true,
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", output, output],
  });

  writeFileSync(pidFile, `${child.pid}\n`);
  child.unref();
};

if (await isPortOpen()) {
  console.log(`Auth backend is already listening on ${host}:${port}.`);
  process.exit(0);
}

if (hasCommand("screen")) {
  startWithScreen();
} else {
  startDetached();
}

if (!(await waitForPort())) {
  throw new Error(`Timed out waiting for auth backend on ${host}:${port}. See ${logFile}`);
}

console.log(`Auth backend is listening on ${host}:${port}. Log: ${logFile}`);
