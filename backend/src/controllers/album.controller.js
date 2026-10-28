import db from "../db/database.js";
import {
  createAlbumSchema,
  updateAlbumSchema,
} from "../validators/album.validator.js";

function getAlbum(id) {
  return db
    .prepare(
      `
    SELECT
      a.*,
      COUNT(p.id) AS photo_count
    FROM albums a
    LEFT JOIN photos p ON p.album_id = a.id
    WHERE a.id = ?
    GROUP BY a.id
  `,
    )
    .get(id);
}

export function listAlbums(req, res) {
  const albums = db
    .prepare(
      `
    SELECT
      a.*,
      COUNT(p.id) AS photo_count
    FROM albums a
    LEFT JOIN photos p ON p.album_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `,
    )
    .all();

  res.json({ albums });
}

export function createAlbum(req, res) {
  const result = createAlbumSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0].message,
    });
  }

  const { name, description } = result.data;

  const insert = db
    .prepare(
      `
    INSERT INTO albums (name, description)
    VALUES (?, ?)
  `,
    )
    .run(name, description);

  const album = getAlbum(Number(insert.lastInsertRowid));

  return res.status(201).json({
    message: "Album created successfully",
    album,
  });
}

export function updateAlbum(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Invalid album ID",
    });
  }

  const existing = db.prepare("SELECT * FROM albums WHERE id = ?").get(id);

  if (!existing) {
    return res.status(404).json({
      error: "Album not found",
    });
  }

  const result = updateAlbumSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0].message,
    });
  }

  const name = result.data.name ?? existing.name;
  const description = result.data.description ?? existing.description;

  db.prepare(
    `
    UPDATE albums
    SET name = ?,
        description = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `,
  ).run(name, description, id);

  return res.json({
    message: "Album updated successfully",
    album: getAlbum(id),
  });
}

export function deleteAlbum(req, res) {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: "Invalid album ID",
    });
  }

  const result = db.prepare("DELETE FROM albums WHERE id = ?").run(id);

  if (result.changes === 0) {
    return res.status(404).json({
      error: "Album not found",
    });
  }

  return res.json({
    message: "Album deleted successfully",
  });
}

export function setAlbumCover(req, res) {
  const albumId = Number(req.params.id);
  const photoId = req.body?.photo_id;

  if (!Number.isSafeInteger(albumId) || albumId < 1) {
    return res.status(400).json({
      error: "Invalid album ID.",
    });
  }

  if (!Number.isSafeInteger(photoId) || photoId < 1) {
    return res.status(400).json({
      error: "A valid photo_id is required.",
    });
  }

  const album = db.prepare("SELECT id FROM albums WHERE id = ?").get(albumId);

  if (!album) {
    return res.status(404).json({
      error: "Album not found.",
    });
  }

  const photo = db
    .prepare(
      `
    SELECT id
    FROM photos
    WHERE id = ? AND album_id = ?
  `,
    )
    .get(photoId, albumId);

  if (!photo) {
    return res.status(400).json({
      error: "The selected photo does not belong to this album.",
    });
  }

  db.prepare(
    `
    UPDATE albums
    SET cover_photo_id = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `,
  ).run(photoId, albumId);

  return res.json({
    message: "Album cover updated successfully.",
    album_id: albumId,
    cover_photo_id: photoId,
  });
}
