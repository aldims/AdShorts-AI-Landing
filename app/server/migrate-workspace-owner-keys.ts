import { Pool } from "pg";

import { database } from "./database.js";
import { runWorkspaceOwnerKeyMigration } from "./workspace-history.js";

const main = async () => {
  const result = await runWorkspaceOwnerKeyMigration();
  console.info(
    `[workspace-owner-keys] scanned_users=${result.scannedUsers} migrated_history_rows=${result.migratedHistoryOwners} migrated_deleted_rows=${result.migratedDeletedOwners}`,
  );
};

void main()
  .catch((error) => {
    console.error("[workspace-owner-keys] Migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (database instanceof Pool) {
      await database.end();
    }
  });
