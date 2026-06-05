import { mkdirSync, createWriteStream, type WriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { formatWithOptions } from "node:util";

import { env } from "./env.js";

type LogLevel = "debug" | "info" | "warn" | "error";

type ServerLogPayload = Record<string, unknown>;

type ConsoleMethod = (...args: unknown[]) => void;

type LoggerState = {
  consoleOutputEnabled: boolean;
  initialized: boolean;
  originalConsole: {
    debug: ConsoleMethod;
    error: ConsoleMethod;
    info: ConsoleMethod;
    warn: ConsoleMethod;
  };
  stream: WriteStream | null;
};

const LOGGER_STATE_KEY = Symbol.for("adshorts.server.logger.state");

const getLoggerState = (): LoggerState => {
  const globalRecord = globalThis as Record<PropertyKey, unknown>;
  const existingState = globalRecord[LOGGER_STATE_KEY];
  if (existingState) {
    return existingState as LoggerState;
  }

  const nextState: LoggerState = {
    consoleOutputEnabled: true,
    initialized: false,
    originalConsole: {
      debug: console.debug.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
    },
    stream: null,
  };
  globalRecord[LOGGER_STATE_KEY] = nextState;
  return nextState;
};

const sanitizeConsoleArgument = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeConsoleArgument(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, sanitizeConsoleArgument(entry)]),
  );
};

const isConsoleWriteError = (error: unknown) => {
  let current: unknown = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const code = "code" in current ? String(current.code ?? "") : "";
    const message = "message" in current ? String(current.message ?? "").toLowerCase() : "";
    if (
      code === "EPIPE" ||
      code === "ERR_STREAM_DESTROYED" ||
      code === "ERR_STREAM_WRITE_AFTER_END" ||
      message.includes("write epipe")
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : null;
  }

  return false;
};

const callOriginalConsoleMethod = (method: ConsoleMethod, args: unknown[]) => {
  const state = getLoggerState();
  if (!state.consoleOutputEnabled) {
    return;
  }

  try {
    method(...args);
  } catch (error) {
    if (!isConsoleWriteError(error)) {
      throw error;
    }
    state.consoleOutputEnabled = false;
  }
};

const installConsoleStreamErrorGuard = () => {
  const state = getLoggerState();
  const handleConsoleStreamError = (error: Error) => {
    if (isConsoleWriteError(error)) {
      state.consoleOutputEnabled = false;
      return;
    }

    writeConsoleLogRecord("error", ["[process] console stream error", error]);
  };

  process.stdout.on("error", handleConsoleStreamError);
  process.stderr.on("error", handleConsoleStreamError);
};

const writeConsoleLogRecord = (level: LogLevel, args: unknown[]) => {
  const state = getLoggerState();
  if (!state.stream) {
    return;
  }

  const message = formatWithOptions(
    {
      breakLength: Infinity,
      colors: false,
      compact: true,
      depth: 8,
    },
    ...args.map((arg) => sanitizeConsoleArgument(arg)),
  );

  state.stream.write(
    JSON.stringify({
      event: "console",
      level,
      message,
      ts: new Date().toISOString(),
    }) + "\n",
  );
};

export const getServerLogFilePath = () => join(env.rootDir, "..", "logs", "runtime", "app.log");

export const initServerLogging = () => {
  const state = getLoggerState();
  if (state.initialized) {
    return getServerLogFilePath();
  }

  const logFilePath = getServerLogFilePath();
  mkdirSync(dirname(logFilePath), { recursive: true });
  state.stream = createWriteStream(logFilePath, {
    encoding: "utf8",
    flags: "a",
  });

  const patchConsoleMethod = (level: LogLevel) => {
    const originalMethod = state.originalConsole[level];
    console[level] = ((...args: unknown[]) => {
      writeConsoleLogRecord(level, args);
      callOriginalConsoleMethod(originalMethod, args);
    }) as ConsoleMethod;
  };

  patchConsoleMethod("debug");
  patchConsoleMethod("info");
  patchConsoleMethod("warn");
  patchConsoleMethod("error");
  installConsoleStreamErrorGuard();

  process.on("uncaughtException", (error) => {
    writeConsoleLogRecord("error", ["[process] uncaughtException", error]);
    callOriginalConsoleMethod(state.originalConsole.error, ["[process] uncaughtException", error]);
  });

  process.on("unhandledRejection", (reason) => {
    writeConsoleLogRecord("error", ["[process] unhandledRejection", reason]);
    callOriginalConsoleMethod(state.originalConsole.error, ["[process] unhandledRejection", reason]);
  });

  state.initialized = true;
  console.info(`[server] Runtime log file: ${logFilePath}`);
  return logFilePath;
};

const sanitizeValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)]),
  );
};

export const logServerEvent = (level: LogLevel, event: string, payload: ServerLogPayload = {}) => {
  const record = {
    ...Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, sanitizeValue(value)]),
    ),
    event,
    level,
    ts: new Date().toISOString(),
  };

  const message = JSON.stringify(record);

  switch (level) {
    case "debug":
      console.debug(message);
      return;
    case "info":
      console.info(message);
      return;
    case "warn":
      console.warn(message);
      return;
    case "error":
      console.error(message);
      return;
  }
};
