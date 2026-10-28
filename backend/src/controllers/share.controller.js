import db from "../db/database.js";
import path from "node:path";
import fs from "node:fs/promises";
import {
  generateShareToken,
  hashShareToken,
} from "../services/share.service.js";

const thumbnailsDir = path.resolve("uploads", "thumbnails");

function findActiveShare(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    return null;
  }

  return db
    .prepare(
      `
    SELECT s.id, s.album_id
    FROM album_shares s
    WHERE s.token_hash = ?
      AND s.is_active = 1
  `,
    )
    .get(hashShareToken(token));
}

// POST /api/albums/:id/share
export function createAlbumShare(req, res) {
  const albumId = Number(req.params.id);

  if (!Number.isSafeInteger(albumId) || albumId < 1) {
    return res.status(400).json({ error: "Invalid album ID." });
  }

  const album = db.prepare("SELECT id FROM albums WHERE id = ?").get(albumId);

  if (!album) {
    return res.status(404).json({ error: "Album not found." });
  }

  const token = generateShareToken();
  const tokenHash = hashShareToken(token);

  // A newly generated link replaces any previous active links.
  const createShare = db.transaction(() => {
    db.prepare(
      `
      UPDATE album_shares
      SET is_active = 0
      WHERE album_id = ? AND is_active = 1
    `,
    ).run(albumId);

    db.prepare(
      `
      INSERT INTO album_shares (album_id, token_hash, is_active)
      VALUES (?, ?, 1)
    `,
    ).run(albumId, tokenHash);
  });

  createShare();

  const frontendUrl = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");

  return res.status(201).json({
    message: "Share link created successfully.",
    album_id: albumId,
    share_url: `${frontendUrl}/shared/${token}`,
    token,
  });
}

// GET /api/shared/:token
export function getSharedAlbum(req, res) {
  const share = findActiveShare(req.params.token);

  if (!share) {
    return res.status(404).json({
      error: "This share link is invalid or has been revoked.",
    });
  }

  const album = db
    .prepare(
      `
    SELECT id, name, description, cover_photo_id, created_at
    FROM albums
    WHERE id = ?
  `,
    )
    .get(share.album_id);

  if (!album) {
    return res.status(404).json({ error: "Album not found." });
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
    .all(share.album_id);

  res.set("Cache-Control", "no-store");

  return res.json({
    album,
    photos: photos.map((photo) => ({
      id: photo.id,
      original_name: photo.original_name,
      captured_at: photo.captured_at,
      uploaded_at: photo.uploaded_at,
      tags: JSON.parse(photo.tags || "[]"),
      thumbnail_url: `/api/shared/${req.params.token}/photos/${photo.id}/thumbnail`,
    })),
  });
}

// GET /api/shared/:token/photos/:photoId/thumbnail
export async function getSharedThumbnail(req, res, next) {
  const share = findActiveShare(req.params.token);

  if (!share) {
    return res.status(404).json({
      error: "This share link is invalid or has been revoked.",
    });
  }

  const photoId = Number(req.params.photoId);

  if (!Number.isSafeInteger(photoId) || photoId < 1) {
    return res.status(400).json({ error: "Invalid photo ID." });
  }

  const photo = db
    .prepare(
      `
    SELECT thumbnail_name
    FROM photos
    WHERE id = ? AND album_id = ?
  `,
    )
    .get(photoId, share.album_id);

  if (!photo) {
    return res.status(404).json({ error: "Photo not found." });
  }

  const thumbnailPath = path.resolve(thumbnailsDir, photo.thumbnail_name);

  if (!thumbnailPath.startsWith(thumbnailsDir + path.sep)) {
    return res.status(400).json({ error: "Invalid thumbnail path." });
  }

  try {
    await fs.access(thumbnailPath);

    // Do not let a browser cache bypass link revocation.
    res.set("Cache-Control", "no-store");

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

// DELETE /api/albums/:id/share
export function revokeAlbumShare(req, res) {
  const albumId = Number(req.params.id);

  if (!Number.isSafeInteger(albumId) || albumId < 1) {
    return res.status(400).json({ error: "Invalid album ID." });
  }

  const album = db.prepare("SELECT id FROM albums WHERE id = ?").get(albumId);

  if (!album) {
    return res.status(404).json({ error: "Album not found." });
  }

  const result = db
    .prepare(
      `
    UPDATE album_shares
    SET is_active = 0
    WHERE album_id = ? AND is_active = 1
  `,
    )
    .run(albumId);

  if (result.changes === 0) {
    return res.status(404).json({
      error: "No active share link exists for this album.",
    });
  }

  return res.json({
    message: "Share link revoked successfully.",
    album_id: albumId,
  });
}
