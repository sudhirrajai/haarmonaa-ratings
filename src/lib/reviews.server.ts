import { createServerFn } from "@tanstack/react-start";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import * as crypto from "crypto";
import { getDb, schema } from "@/lib/db.server";

// ─── Fetch approved reviews with pagination (public) ─────────────────────────

const paginationSchema = z.object({
  limit: z.number().int().min(1).max(50).default(8),
  offset: z.number().int().min(0).default(0),
}).optional();

export const getApprovedReviews = createServerFn({ method: "GET" })
  .validator((d: unknown) => paginationSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const db = getDb();
    const limit = data?.limit ?? 8;
    const offset = data?.offset ?? 0;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: schema.reviews.id,
          name: schema.reviews.name,
          product: schema.reviews.product,
          rating: schema.reviews.rating,
          comment: schema.reviews.comment,
          image_url: schema.reviews.image_url,
          created_at: schema.reviews.created_at,
        })
        .from(schema.reviews)
        .where(eq(schema.reviews.status, "approved"))
        .orderBy(desc(schema.reviews.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({
          count: sql<number>`count(*)`,
          avgRating: sql<number>`coalesce(avg(${schema.reviews.rating}), 0)`,
        })
        .from(schema.reviews)
        .where(eq(schema.reviews.status, "approved")),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const avg = Number(countResult[0]?.avgRating ?? 0);

    return {
      reviews: rows.map((r) => ({
        ...r,
        created_at: r.created_at.toISOString(),
        photo: r.image_url ?? null,
      })),
      total,
      average: Math.round(avg * 10) / 10,
      hasMore: offset + rows.length < total,
    };
  });

// ─── Submit a review (public) ─────────────────────────────────────────────────

const submitSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).nullish(),
  product: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(1000),
  image_url: z.string().max(500).nullish(),
});

export const submitReview = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.insert(schema.reviews).values({
      id,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      product: data.product,
      rating: data.rating,
      comment: data.comment,
      image_url: data.image_url ?? null,
      status: "pending",
    });
    return { id, message: "Review submitted — it will appear once approved." };
  });
