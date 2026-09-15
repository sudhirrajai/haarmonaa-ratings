import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db.server";
import { requireAdminAuth } from "@/lib/auth.server";
import { ensureEnvLoaded } from "@/lib/env.server";

ensureEnvLoaded();

let settingsTableInitialized = false;

async function ensureSettingsTable() {
  if (settingsTableInitialized) return;
  const db = getDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`settings\` (
        \`key\` VARCHAR(80) NOT NULL,
        \`value\` TEXT NOT NULL,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    settingsTableInitialized = true;
  } catch {
    // If already exists or error, continue
  }
}

/**
 * Read auto-approve setting (defaults to true if not set)
 */
export async function isAutoApproveEnabled(): Promise<boolean> {
  await ensureSettingsTable();
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "auto_approve"))
      .limit(1);

    if (rows.length === 0) return true; // default: true
    return rows[0]!.value === "true";
  } catch {
    return true;
  }
}

// ─── Server functions for admin UI ───────────────────────────────────────────

export const getAutoApprove = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    return { enabled: await isAutoApproveEnabled() };
  });

const toggleSchema = z.object({ enabled: z.boolean() });

export const setAutoApprove = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((data: unknown) => toggleSchema.parse(data))
  .handler(async ({ data }) => {
    await ensureSettingsTable();
    const db = getDb();
    const val = data.enabled ? "true" : "false";

    await db.execute(sql`
      INSERT INTO \`settings\` (\`key\`, \`value\`)
      VALUES ('auto_approve', ${val})
      ON DUPLICATE KEY UPDATE \`value\` = ${val}
    `);

    return { success: true, enabled: data.enabled };
  });
