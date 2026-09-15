/**
 * drizzle/seed.ts
 * Run once to create the default admin account.
 *
 *   npx tsx drizzle/seed.ts
 *
 * Edit ADMIN_EMAIL / ADMIN_PASSWORD before running, or pass via env:
 *   ADMIN_EMAIL=owner@stall.com ADMIN_PASSWORD=mysecretpass npx tsx drizzle/seed.ts
 */
import * as fs from "fs";
import * as path from "path";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import * as crypto from "crypto";
import * as schema from "./schema";

// Simple zero-dependency .env loader for the seed script
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch {
  // Ignore errors reading .env
}

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "admin@stall.local";
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "admin123";

async function main() {
  const MYSQL_URL = process.env["MYSQL_URL"];
  if (!MYSQL_URL) {
    console.error("Error: MYSQL_URL is not set in your .env file.");
    process.exit(1);
  }

  const pool = mysql.createPool(MYSQL_URL);
  const db = drizzle(pool, { schema, mode: "default" });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const id = crypto.randomUUID();

  try {
    await db.insert(schema.admins).values({
      id,
      email: ADMIN_EMAIL.toLowerCase().trim(),
      password_hash: passwordHash,
    });
    console.log(`✅ Admin created successfully:`);
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   ID:       ${id}`);
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    if (error.code === "ER_DUP_ENTRY") {
      console.log(`ℹ️  Admin with email "${ADMIN_EMAIL}" already exists. Skipping.`);
    } else {
      console.error("Error seeding admin:", error.message);
      process.exit(1);
    }
  }

  // Also seed default categories if table is empty
  const existingCategories = await db.select().from(schema.categories).limit(1);
  if (existingCategories.length === 0) {
    const defaultItems = [
      "Kada", "Earrings", "Jhumkas", "Necklace",
      "Bangles", "Bracelet", "Anklet", "Ring",
      "Maang tikka", "Hair accessory", "Other",
    ];
    await db.insert(schema.categories).values(
      defaultItems.map((name, i) => ({
        id: crypto.randomUUID(),
        name,
        sort_order: i + 1,
        is_active: true,
      })),
    );
    console.log(`✅ Seeded ${defaultItems.length} default jewellery categories.`);
  }

  await pool.end();
  console.log("Done.");
}

main();
