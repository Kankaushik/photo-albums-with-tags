import db from "../db/database.js";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { generateThumbnail, getPhotoDate } from "../services/image.service.js";

const uploadRoot = path.resolve("uploads");
const originalsDir = path.join(uploadRoot, "originals");
const thumbnailsDir = path.join(uploadRoot, "thumbnails");

// --------------------------------------------------
// UPLOAD MULTIPLE PHOTOS
// POST /api/albums/:id/photos
// --------------------------------------------------
export async function uploadPhotos(req, res, next) {
  const albumId = Number(req.params.id);

  if (!Number.isSafeInteger(albumId) || albumId < 1) {
    return res.status(400).json({
      error: "Invalid album ID.",
    });
  }

  const album = db.prepare("SELECT id FROM albums WHERE id = ?").get(albumId);

  if (!album) {
    return res.status(404).json({
      error: "Album not found.",
    });
  }

  if (!req.files?.length) {
    return res.status(400).json({
      error: "Select at least one photo to upload.",
    });
  }

  const savedFiles = [];
  const insertedPhotoIds = [];

  try {
    await fs.mkdir(originalsDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // Process each file and generate its thumbnail.
    const processedPhotos = [];

    for (const file of req.files) {
      const image = sharp(file.buffer, {
        limitInputPixels: 40000000,
      });

      const metadata = await image.metadata();

      const allowedFormats = ["jpeg", "png", "webp"];

      if (
        !allowedFormats.includes(metadata.format) ||
        !metadata.width ||
        !metadata.height ||
        metadata.width * metadata.height > 40000000
      ) {
        throw new Error(`Invalid or unsupported image: ${file.originalname}`);
      }

      const id = randomUUID();
      const storedName = `${id}.${metadata.format}`;
      const thumbnailName = `${id}.jpg`;

      const originalPath = path.join(originalsDir, storedName);
      const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

      // Re-encode the image and normalize its orientation.
      // Do not trust a client-provided filename for storage.
      await sharp(file.buffer, {
        limitInputPixels: 40000000,
      })
        .rotate()
        .toFormat(metadata.format)
        .toFile(originalPath);

      savedFiles.push(originalPath);

      await generateThumbnail(originalPath, thumbnailPath);
      savedFiles.push(thumbnailPath);

      // Extract EXIF capture date when available.
      const capturedAt = await getPhotoDate(originalPath);

      processedPhotos.push({
        albumId,
        originalName: path.basename(file.originalname).slice(0, 255),
        storedName,
        thumbnailName,
        mimeType: `image/${
          metadata.format === "jpeg" ? "jpeg" : metadata.format
        }`,
        sizeBytes: file.size,
        capturedAt,
      });
    }

    // Insert all metadata in one database transaction.
    const insertPhotos = db.transaction((photos) => {
      const insert = db.prepare(`
        INSERT INTO photos (
          album_id,
          original_name,
          stored_name,
          thumbnail_name,
          mime_type,
          size_bytes,
          captured_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      return photos.map((photo) => {
        const result = insert.run(
          photo.albumId,
          photo.originalName,
          photo.storedName,
          photo.thumbnailName,
          photo.mimeType,
          photo.sizeBytes,
          photo.capturedAt,
        );

        return {
          id: Number(result.lastInsertRowid),
          ...photo,
        };
      });
    });

    const photos = insertPhotos(processedPhotos);

    insertedPhotoIds.push(...photos.map((photo) => photo.id));

    return res.status(201).json({
      message: "Photos uploaded successfully.",
      photos: photos.map((photo) => ({
        id: photo.id,
        album_id: photo.albumId,
        original_name: photo.originalName,
        thumbnail_name: photo.thumbnailName,
        captured_at: photo.capturedAt,
        uploaded_at: new Date().toISOString(),
        thumbnail_url: `/api/photos/${photo.id}/thumbnail`,
      })),
    });
  } catch (error) {
    // If the database transaction succeeded but a later operation
    // failed, remove any records inserted by this request.
    if (insertedPhotoIds.length > 0) {
      try {
        const removeRecords = db.transaction((ids) => {
          const remove = db.prepare("DELETE FROM photos WHERE id = ?");

          for (const id of ids) {
            remove.run(id);
          }
        });

        removeRecords(insertedPhotoIds);
      } catch (cleanupError) {
        console.error("Photo record cleanup failed:", cleanupError);
      }
    }

    // Remove files created by this request.
    await Promise.all(
      savedFiles.map((filePath) =>
        fs.rm(filePath, { force: true }).catch((cleanupError) => {
          console.error("File cleanup failed:", cleanupError);
        }),
      ),
    );

    // Invalid images should return a clear client error.
    if (error.message?.startsWith("Invalid or unsupported image:")) {
      return res.status(400).json({
        error: error.message,
      });
    }

    return next(error);
  }
}

// --------------------------------------------------
// LIST PHOTOS IN AN ALBUM
// GET /api/albums/:id/photos
// --------------------------------------------------
export function listAlbumPhotos(req, res) {
  const albumId = Number(req.params.id);

  if (!Number.isSafeInteger(albumId) || albumId < 1) {
    return res.status(400).json({
      error: "Invalid album ID.",
    });
  }

  const album = db.prepare("SELECT id FROM albums WHERE id = ?").get(albumId);

  if (!album) {
    return res.status(404).json({
      error: "Album not found.",
    });
  }

  const photos = db
    .prepare(
      `
    SELECT
      p.id,
      p.album_id,
      p.original_name,
      p.thumbnail_name,
      p.captured_at,
      p.uploaded_at,
      COALESCE(p.captured_at, p.uploaded_at) AS sort_date,
      (
        SELECT json_group_array(t.name)
        FROM photo_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.photo_id = p.id
      ) AS tags
    FROM photos p
    WHERE p.album_id = ?
    ORDER BY sort_date DESC, p.id DESC
  `,
    )
    .all(albumId);

  return res.json({
    photos: photos.map((photo) => ({
      ...photo,
      tags: JSON.parse(photo.tags || "[]"),
      thumbnail_url: `/api/photos/${photo.id}/thumbnail`,
    })),
  });
}

// --------------------------------------------------
// SERVE THUMBNAIL ONLY
// GET /api/photos/:id/thumbnail
// --------------------------------------------------
export async function getPhotoThumbnail(req, res, next) {
  const photoId = Number(req.params.id);

  if (!Number.isSafeInteger(photoId) || photoId < 1) {
    return res.status(400).json({
      error: "Invalid photo ID.",
    });
  }

  const photo = db
    .prepare(
      `
    SELECT thumbnail_name
    FROM photos
    WHERE id = ?
  `,
    )
    .get(photoId);

  if (!photo) {
    return res.status(404).json({
      error: "Photo not found.",
    });
  }

  const thumbnailPath = path.resolve(thumbnailsDir, photo.thumbnail_name);

  // Ensure the resolved file remains inside the thumbnail directory.
  if (!thumbnailPath.startsWith(thumbnailsDir + path.sep)) {
    return res.status(400).json({
      error: "Invalid thumbnail path.",
    });
  }

  try {
    await fs.access(thumbnailPath);

    res.set("Cache-Control", "private, max-age=3600");

    return res.sendFile(thumbnailPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({
        error: "Thumbnail file not found.",
      });
    }

    return next(error);
  }
}

// --------------------------------------------------
// DELETE A PHOTO
// DELETE /api/photos/:id
// --------------------------------------------------
export async function deletePhoto(req, res, next) {
  const photoId = Number(req.params.id);

  if (!Number.isSafeInteger(photoId) || photoId < 1) {
    return res.status(400).json({
      error: "Invalid photo ID.",
    });
  }

  const photo = db
    .prepare(
      `
    SELECT id, album_id, stored_name, thumbnail_name
    FROM photos
    WHERE id = ?
  `,
    )
    .get(photoId);

  if (!photo) {
    return res.status(404).json({
      error: "Photo not found.",
    });
  }

  try {
    // Delete the database record and clear the cover reference atomically.
    const removePhoto = db.transaction(() => {
      db.prepare("DELETE FROM photo_tags WHERE photo_id = ?").run(photoId);

      db.prepare("DELETE FROM photos WHERE id = ?").run(photoId);

      db.prepare(
        `
        UPDATE albums
        SET cover_photo_id = NULL
        WHERE id = ? AND cover_photo_id = ?
      `,
      ).run(photo.album_id, photoId);
    });

    removePhoto();

    // Remove files only after the database transaction succeeds.
    await Promise.all([
      fs.rm(path.join(originalsDir, photo.stored_name), { force: true }),
      fs.rm(path.join(thumbnailsDir, photo.thumbnail_name), { force: true }),
    ]);

    return res.json({
      message: "Photo deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
}
