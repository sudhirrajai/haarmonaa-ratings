import {
  mysqlTable,
  varchar,
  text,
  int,
  boolean,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

// ─── Categories ──────────────────────────────────────────────────────────────
export const categories = mysqlTable("categories", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  sort_order: int("sort_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

// ─── Reviews ─────────────────────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  product: varchar("product", { length: 80 }).notNull(),
  rating: int("rating").notNull(),
  comment: text("comment").notNull(),
  image_url: varchar("image_url", { length: 500 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"])
    .notNull()
    .default("pending"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ─── Admins ──────────────────────────────────────────────────────────────────
export const admins = mysqlTable("admins", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password_hash: varchar("password_hash", { length: 255 }).notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

// ─── Settings ────────────────────────────────────────────────────────────────
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value").notNull(),
});

