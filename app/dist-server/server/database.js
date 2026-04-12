import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { env } from "./env.js";
const resolveFromRoot = (value) => {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error("Database path is required.");
    }
    return isAbsolute(normalized) ? normalized : resolve(env.rootDir, normalized);
};
const resolveSqliteTarget = (value) => {
    const normalized = value.trim();
    if (normalized.startsWith("file:")) {
        return fileURLToPath(new URL(normalized));
    }
    if (normalized.startsWith("sqlite://")) {
        const rawPath = decodeURIComponent(normalized.slice("sqlite://".length));
        return resolveFromRoot(rawPath);
    }
    if (normalized.startsWith("sqlite:")) {
        const rawPath = decodeURIComponent(normalized.slice("sqlite:".length));
        return resolveFromRoot(rawPath);
    }
    return resolveFromRoot(normalized);
};
const resolveAuthDatabaseConfig = () => {
    const databaseUrl = env.authDatabaseUrl?.trim();
    if (env.isProduction && !databaseUrl) {
        throw new Error("AUTH_DATABASE_URL must be set in production.");
    }
    if (databaseUrl) {
        if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
            return {
                kind: "postgres",
                target: databaseUrl,
                description: `postgres:${new URL(databaseUrl).host}`,
            };
        }
        if (databaseUrl.startsWith("sqlite:") || databaseUrl.startsWith("file:")) {
            if (env.isProduction) {
                throw new Error("SQLite AUTH_DATABASE_URL is not allowed in production. Use PostgreSQL.");
            }
            const target = resolveSqliteTarget(databaseUrl);
            return {
                kind: "sqlite",
                target,
                description: target,
            };
        }
        throw new Error(`Unsupported AUTH_DATABASE_URL scheme: ${databaseUrl}`);
    }
    if (env.isProduction) {
        throw new Error("SQLite auth database path is not allowed in production. Use AUTH_DATABASE_URL with PostgreSQL.");
    }
    const target = resolveSqliteTarget(env.authDatabasePath);
    return {
        kind: "sqlite",
        target,
        description: target,
    };
};
export const authDatabaseConfig = resolveAuthDatabaseConfig();
const require = createRequire(import.meta.url);
const loadSqliteDatabaseSync = () => {
    const sqlite = require("node:sqlite");
    return sqlite.DatabaseSync;
};
const createDatabase = () => {
    if (authDatabaseConfig.kind === "postgres") {
        return new Pool({
            connectionString: authDatabaseConfig.target,
            max: 10,
        });
    }
    mkdirSync(dirname(authDatabaseConfig.target), { recursive: true });
    const DatabaseSync = loadSqliteDatabaseSync();
    return new DatabaseSync(authDatabaseConfig.target);
};
export const database = createDatabase();
