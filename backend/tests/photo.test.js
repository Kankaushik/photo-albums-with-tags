import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import app from "../src/server.js";
import db from "../src/db/database.js";

describe("Stillroom Photos API", () => {
  let albumId;
  let uploadedPhotoId;
  let imageBuffer;

  beforeAll(async () => {
    const album = db
      .prepare("INSERT INTO albums (name, description) VALUES (?, ?)")
      .run("Photo API Test Album", "Temporary test album");

    albumId = Number(album.lastInsertRowid);

    // Generate a real, tiny JPEG in memory.
    imageBuffer = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 120, g: 150, b: 100 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    // Delete the temporary album and its photo records.
    if (albumId) {
      db.prepare("DELETE FROM albums WHERE id = ?").run(albumId);
    }

    // Clean up files left by these tests, if any.
    const uploadRoot = path.resolve("uploads");

    if (uploadedPhotoId) {
      // The controller uses UUID-based filenames. Retrieve the names
      // before cleanup if the record still exists.
      const photo = db
        .prepare("SELECT stored_name, thumbnail_name FROM photos WHERE id = ?")
        .get(uploadedPhotoId);

      if (photo) {
        await Promise.all([
          fs.rm(path.join(uploadRoot, "originals", photo.stored_name), {
            force: true,
          }),
          fs.rm(path.join(uploadRoot, "thumbnails", photo.thumbnail_name), {
            force: true,
          }),
        ]);
      }
    }
  });

  it("1. Uploading a valid JPEG returns 201", async () => {
    const response = await request(app)
      .post(`/api/albums/${albumId}/photos`)
      .attach("photos", imageBuffer, {
        filename: "test-photo.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Photos uploaded successfully.");
    expect(response.body.photos).toHaveLength(1);

    uploadedPhotoId = response.body.photos[0].id;

    expect(uploadedPhotoId).toBeDefined();
    expect(response.body.photos[0].original_name).toBe("test-photo.jpg");
  });

  it("2. Uploading an unsupported file is rejected", async () => {
    const response = await request(app)
      .post(`/api/albums/${albumId}/photos`)
      .attach("photos", Buffer.from("this is not an image"), {
        filename: "not-an-image.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain(
      "Only JPEG, PNG, and WebP images are allowed.",
    );
  });

  it("3. Listing album photos includes the uploaded photo", async () => {
    // Upload first if the preceding upload test failed or was skipped.
    if (!uploadedPhotoId) {
      const upload = await request(app)
        .post(`/api/albums/${albumId}/photos`)
        .attach("photos", imageBuffer, {
          filename: "test-photo.jpg",
          contentType: "image/jpeg",
        });

      expect(upload.status).toBe(201);
      uploadedPhotoId = upload.body.photos[0].id;
    }

    const response = await request(app).get(`/api/albums/${albumId}/photos`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.photos)).toBe(true);
    expect(
      response.body.photos.some((photo) => photo.id === uploadedPhotoId),
    ).toBe(true);
  });

  it("4. Uploading to a nonexistent album returns 404", async () => {
    const response = await request(app)
      .post("/api/albums/999999999/photos")
      .attach("photos", imageBuffer, {
        filename: "test-photo.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Album not found.");
  });

  it("5. Deleting a photo removes its database record", async () => {
    // Create a photo through the real upload endpoint.
    const upload = await request(app)
      .post(`/api/albums/${albumId}/photos`)
      .attach("photos", imageBuffer, {
        filename: "photo-to-delete.jpg",
        contentType: "image/jpeg",
      });

    expect(upload.status).toBe(201);

    const photoId = upload.body.photos[0].id;

    const response = await request(app).delete(`/api/photos/${photoId}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Photo deleted successfully.");

    const record = db
      .prepare("SELECT id FROM photos WHERE id = ?")
      .get(photoId);

    expect(record).toBeUndefined();
  });
});
