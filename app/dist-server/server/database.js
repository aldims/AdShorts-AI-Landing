import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
    if (databaseUrl) {
        if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
            return {
                kind: "postgres",
                target: databaseUrl,
                description: `postgres:${new URL(databaseUrl).host}`,
            };
        }
        if (databaseUrl.startsWith("sqlite:") || databaseUrl.startsWith("file:")) {
            const target = resolveSqliteTarget(databaseUrl);
            return {
                kind: "sqlite",
                target,
                description: target,
            };
        }
        throw new Error(`Unsupported AUTH_DATABASE_URL scheme: ${databaseUrl}`);
    }
    const target = resolveSqliteTarget(env.authDatabasePath);
    return {
        kind: "sqlite",
        target,
        description: target,
    };
};
export const authDatabaseConfig = resolveAuthDatabaseConfig();
const createDatabase = () => {
    if (authDatabaseConfig.kind === "postgres") {
        return new Pool({
            connectionString: authDatabaseConfig.target,
            max: 10,
        });
    }
    mkdirSync(dirname(authDatabaseConfig.target), { recursive: true });
    return new DatabaseSync(authDatabaseConfig.target);
};
export const database = createDatabase();
