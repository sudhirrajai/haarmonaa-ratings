/**
 * src/lib/upload.server.ts
 * Local filesystem image upload — stores files in public/uploads/.
 * Works exactly like Laravel's Storage::disk('public')->put().
 *
 * Files are served statically by Vite/Nitro from the public/ directory,
 * so a saved file at public/uploads/abc.jpg is accessible at /uploads/abc.jpg.
 */
import { createServerFn } from "@tanstack/react-start";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import * as crypto from "crypto";
import { z } from "zod";
import { ensureEnvLoaded } from "./env.server";

ensureEnvLoaded();

// Resolve the uploads directory relative to the project root (process.cwd())
// In dev: <project>/public/uploads/
// In production: configure UPLOADS_DIR env to an absolute path, or defaults to <project>/public/uploads
function getUploadsDir(): string {
  return process.env["UPLOADS_DIR"] ?? join(process.cwd(), "public", "uploads");
}

const uploadSchema = z.object({
  /** Base64-encoded file data (without the data:image/...;base64, prefix) */
  base64: z.string().min(1),
  /** MIME type e.g. "image/jpeg" */
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp|gif|avif|heic)$/i),
  /** Original filename, used only to extract the extension */
  filename: z.string().max(255),
});

export const uploadImage = createServerFn({ method: "POST" })
  .validator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    // Derive extension safely
    const rawExt = extname(data.filename).toLowerCase().replace(".", "") || "jpg";
    const safeExt = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";

    const filename = `${crypto.randomUUID()}.${safeExt}`;
    const uploadsDir = getUploadsDir();
    const fullPath = join(uploadsDir, filename);

    // Decode base64 → binary buffer
    const buffer = Buffer.from(data.base64, "base64");

    // Sanity check: reject files > 10 MB
    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new Error("File too large. Maximum size is 10 MB.");
    }

    try {
      // Ensure uploads directory exists (like Laravel's storage:link)
      await mkdir(uploadsDir, { recursive: true });
      await writeFile(fullPath, buffer);
      console.log(`[Upload] File saved to: ${fullPath}`);
    } catch (err: unknown) {
      const e = err as Error;
      console.error(`[Upload Error] Failed saving to ${fullPath}:`, e);
      throw new Error(`Failed to save image to disk: ${e.message}`);
    }

    // Return the public URL path (served statically by Nginx/Vite)
    return { url: `/uploads/${filename}` };
  });
