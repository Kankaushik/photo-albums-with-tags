import db from "../db/database.js";
import { photoTagsSchema } from "../validators/tag.validator.js";

// Add or replace tags on a photo.
export function setPhotoTags(req, res) {
  const photoId = Number(req.params.id);

  if (!Number.isSafeInteger(photoId) || photoId < 1) {
    return res.status(400).json({ error: "Invalid photo ID." });
  }

  const result = photoTagsSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0].message,
    });
  }

  const photo = db.prepare("SELECT id FROM photos WHERE id = ?").get(photoId);

  if (!photo) {
    return res.status(404).json({ error: "Photo not found." });
  }

  // Normalize case and remove duplicate tags.
  const tags = [
    ...new Set(result.data.tags.map((tag) => tag.trim().toLowerCase())),
  ];

  const updateTags = db.transaction(() => {
    db.prepare("DELETE FROM photo_tags WHERE photo_id = ?").run(photoId);

    const findTag = db.prepare(
      "SELECT id FROM tags WHERE name = ? COLLATE NOCASE",
    );

    const insertTag = db.prepare("INSERT INTO tags (name) VALUES (?)");

    const attachTag = db.prepare(`
      INSERT INTO photo_tags (photo_id, tag_id)
      VALUES (?, ?)
    `);

    for (const name of tags) {
      let tag = findTag.get(name);

      if (!tag) {
        const inserted = insertTag.run(name);
        tag = { id: Number(inserted.lastInsertRowid) };
      }

      attachTag.run(photoId, tag.id);
    }
  });

  updateTags();

  return res.json({
    message: "Photo tags updated successfully.",
    photo_id: photoId,
    tags,
  });
}

// List all tags used by photos.
export function listTags(req, res) {
  const tags = db
    .prepare(
      `
    SELECT t.id, t.name, COUNT(pt.photo_id) AS photo_count
    FROM tags t
    JOIN photo_tags pt ON pt.tag_id = t.id
    GROUP BY t.id, t.name
    ORDER BY t.name COLLATE NOCASE
  `,
    )
    .all();

  return res.json({ tags });
}

// Search photos by one or more tags.
// All requested tags must match (AND search).
export function searchPhotos(req, res) {
  const rawTags = req.query.tags;

  if (typeof rawTags !== "string" || !rawTags.trim()) {
    return res.status(400).json({
      error: "Provide tags, for example ?tags=travel,nature.",
    });
  }

  const tags = [
    ...new Set(rawTags.split(",").map((tag) => tag.trim().toLowerCase())),
  ];

  if (
    tags.length > 20 ||
    tags.some(
      (tag) =>
        tag.length < 1 || tag.length > 30 || !/^[a-zA-Z0-9 _-]+$/.test(tag),
    )
  ) {
    return res.status(400).json({
      error: "Provide up to 20 valid tags, each no longer than 30 characters.",
    });
  }

  const placeholders = tags.map(() => "?").join(", ");

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
      COALESCE(p.captured_at, p.uploaded_at) AS sort_date
    FROM photos p
    JOIN photo_tags pt ON pt.photo_id = p.id
    JOIN tags t ON t.id = pt.tag_id
    WHERE t.name COLLATE NOCASE IN (${placeholders})
    GROUP BY p.id
    HAVING COUNT(DISTINCT t.id) = ?
    ORDER BY sort_date DESC, p.id DESC
  `,
    )
    .all(...tags, tags.length);

  return res.json({
    tags,
    match: "all",
    photos: photos.map((photo) => ({
      ...photo,
      thumbnail_url: `/api/photos/${photo.id}/thumbnail`,
    })),
  });
}
