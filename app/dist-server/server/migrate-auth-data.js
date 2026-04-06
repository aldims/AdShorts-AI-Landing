import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { ensureAuthSchema } from "./auth.js";
import { authDatabaseConfig, database } from "./database.js";
import { env } from "./env.js";
const AUTH_TABLES = {
    account: [
        "id",
        "accountId",
        "providerId",
        "userId",
        "accessToken",
        "refreshToken",
        "idToken",
        "accessTokenExpiresAt",
        "refreshTokenExpiresAt",
        "scope",
        "password",
        "createdAt",
        "updatedAt",
    ],
    session: ["id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId"],
    user: ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt"],
    verification: ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
};
const AUTH_TABLE_ORDER = ["user", "account", "session", "verification"];
const quoteIdentifier = (value) => `"${value.replaceAll(`"`, `""`)}"`;
const resolveSourcePath = () => {
    const normalized = env.authLegacyDatabasePath.trim();
    return isAbsolute(normalized) ? normalized : resolve(env.rootDir, normalized);
};
const loadSourceRows = (sourceDb, table) => {
    const columns = AUTH_TABLES[table].map((column) => quoteIdentifier(column)).join(", ");
    const statement = sourceDb.prepare(`SELECT ${columns} FROM ${quoteIdentifier(table)}`);
    return statement.all();
};
const toSqliteValue = (value) => {
    if (value === undefined || value === null)
        return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint")
        return value;
    if (typeof value === "boolean")
        return Number(value);
    return String(value);
};
const copyToSqlite = (targetDb, table, rows) => {
    if (!rows.length)
        return;
    const columns = AUTH_TABLES[table];
    const placeholders = columns.map(() => "?").join(", ");
    const statement = targetDb.prepare(`INSERT OR IGNORE INTO ${quoteIdentifier(table)} (${columns.map((column) => quoteIdentifier(column)).join(", ")}) VALUES (${placeholders})`);
    targetDb.exec("BEGIN");
    try {
        for (const row of rows) {
            statement.run(...columns.map((column) => toSqliteValue(row[column])));
        }
        targetDb.exec("COMMIT");
    }
    catch (error) {
        targetDb.exec("ROLLBACK");
        throw error;
    }
};
const copyToPostgres = async (targetDb, table, rows) => {
    if (!rows.length)
        return;
    const columns = AUTH_TABLES[table];
    const columnList = columns.map((column) => quoteIdentifier(column)).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const query = `INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES (${placeholders}) ON CONFLICT (${quoteIdentifier("id")}) DO NOTHING`;
    const client = await targetDb.connect();
    try {
        await client.query("BEGIN");
        for (const row of rows) {
            await client.query(query, columns.map((column) => row[column] ?? null));
        }
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
};
const countSourceRows = (sourceDb, table) => {
    const result = sourceDb.prepare(`SELECT COUNT(*) AS total FROM ${quoteIdentifier(table)}`).get();
    return Number(result.total ?? 0);
};
const main = async () => {
    const sourcePath = resolveSourcePath();
    if (!existsSync(sourcePath)) {
        console.info(`[auth-migrate] Legacy auth database not found: ${sourcePath}`);
        return;
    }
    if (authDatabaseConfig.kind === "sqlite" && authDatabaseConfig.target === sourcePath) {
        console.info("[auth-migrate] Shared auth database already points to the legacy SQLite file. Nothing to copy.");
        return;
    }
    await ensureAuthSchema();
    const sourceDb = new DatabaseSync(sourcePath, { open: true, readOnly: true });
    try {
        for (const table of AUTH_TABLE_ORDER) {
            const sourceCount = countSourceRows(sourceDb, table);
            if (!sourceCount) {
                console.info(`[auth-migrate] ${table}: 0 rows`);
                continue;
            }
            const rows = loadSourceRows(sourceDb, table);
            if (database instanceof Pool) {
                await copyToPostgres(database, table, rows);
            }
            else {
                copyToSqlite(database, table, rows);
            }
            console.info(`[auth-migrate] ${table}: copied ${rows.length} rows`);
        }
    }
    finally {
        sourceDb.close();
        if (database instanceof Pool) {
            await database.end();
        }
    }
};
void main().catch((error) => {
    console.error("[auth-migrate] Failed to migrate Better Auth data", error);
    process.exit(1);
});
