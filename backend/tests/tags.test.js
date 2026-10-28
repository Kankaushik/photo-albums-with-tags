import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import db from "../src/db/database.js";

describe("Stillroom Photo Tags API", () => {
  let albumId;
  let photoBothId;
  let photoCollegeId;
  let photoNatureId;

  beforeAll(() => {
    // Create one test album in the test database.
    const album = db
      .prepare("INSERT INTO albums (name, description) VALUES (?, ?)")
      .run("Tag API Test Album", "Temporary test data");

    albumId = Number(album.lastInsertRowid);

    // Create three test photos without uploading physical files.
    const insertPhoto = db.prepare(`
      INSERT INTO photos (
        album_id,
        original_name,
        stored_name,
        thumbnail_name,
        mime_type,
        size_bytes
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    photoBothId = Number(
      insertPhoto.run(
        albumId,
        "college-nature.jpg",
        "test-both.jpg",
        "test-both-thumb.jpg",
        "image/jpeg",
        1000,
      ).lastInsertRowid,
    );

    photoCollegeId = Number(
      insertPhoto.run(
        albumId,
        "college-only.jpg",
        "test-college.jpg",
        "test-college-thumb.jpg",
        "image/jpeg",
        1000,
      ).lastInsertRowid,
    );

    photoNatureId = Number(
      insertPhoto.run(
        albumId,
        "nature-only.jpg",
        "test-nature.jpg",
        "test-nature-thumb.jpg",
        "image/jpeg",
        1000,
      ).lastInsertRowid,
    );
  });

  afterAll(() => {
    // Foreign-key cascades remove these photos and their photo-tag links.
    if (albumId) {
      db.prepare("DELETE FROM albums WHERE id = ?").run(albumId);
    }
  });

  it("1. PUT /api/photos/:id/tags saves and normalizes tags", async () => {
    const response = await request(app)
      .put(`/api/photos/${photoBothId}/tags`)
      .send({
        tags: ["College", "Nature", "college"],
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Photo tags updated successfully.");
    expect(response.body.photo_id).toBe(photoBothId);
    expect(response.body.tags).toEqual(["college", "nature"]);
  });

  it("2. GET /api/tags lists tags attached to photos", async () => {
    // Attach tags first so the listing has test data.
    await request(app)
      .put(`/api/photos/${photoBothId}/tags`)
      .send({ tags: ["college", "nature"] });

    const response = await request(app).get("/api/tags");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.tags)).toBe(true);

    const names = response.body.tags.map((tag) => tag.name);

    expect(names).toContain("college");
    expect(names).toContain("nature");
  });

  it("3. Tag search returns only photos matching ALL requested tags", async () => {
    // Photo A has both tags.
    await request(app)
      .put(`/api/photos/${photoBothId}/tags`)
      .send({ tags: ["college", "nature"] });

    // Photo B has only college.
    await request(app)
      .put(`/api/photos/${photoCollegeId}/tags`)
      .send({ tags: ["college"] });

    // Photo C has only nature.
    await request(app)
      .put(`/api/photos/${photoNatureId}/tags`)
      .send({ tags: ["nature"] });

    const response = await request(app)
      .get("/api/photos/search")
      .query({ tags: "college,nature" });

    expect(response.status).toBe(200);
    expect(response.body.match).toBe("all");
    expect(response.body.tags).toEqual(["college", "nature"]);

    const returnedIds = response.body.photos.map((photo) => photo.id);

    expect(returnedIds).toContain(photoBothId);
    expect(returnedIds).not.toContain(photoCollegeId);
    expect(returnedIds).not.toContain(photoNatureId);
    expect(returnedIds).toHaveLength(1);
  });

  it("4. Tag search rejects a missing tags query", async () => {
    const response = await request(app).get("/api/photos/search");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Provide tags");
  });

  it("5. Adding tags to a nonexistent photo returns 404", async () => {
    const response = await request(app)
      .put("/api/photos/999999999/tags")
      .send({ tags: ["college"] });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Photo not found.");
  });
});
