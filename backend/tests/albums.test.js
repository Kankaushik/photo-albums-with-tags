import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import db from "../src/db/database.js";

describe("Stillroom Album API", () => {
  let albumId;

  beforeAll(() => {
    // Create a test album to use in update and delete tests.
    const result = db
      .prepare("INSERT INTO albums (name, description) VALUES (?, ?)")
      .run("Automated Test Album", "Created for API testing");

    albumId = Number(result.lastInsertRowid);
  });

  afterAll(() => {
    // Remove only the test album created by this test suite.
    if (albumId) {
      db.prepare("DELETE FROM albums WHERE id = ?").run(albumId);
    }
  });

  it("1. GET /api/albums returns an albums array", async () => {
    const response = await request(app).get("/api/albums");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.albums)).toBe(true);
  });

  it("2. POST /api/albums creates an album", async () => {
    const response = await request(app).post("/api/albums").send({
      name: "API Created Album",
      description: "Created by Supertest",
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Album created successfully");
    expect(response.body.album.name).toBe("API Created Album");
    expect(response.body.album.id).toBeDefined();

    // Clean up this test's album.
    db.prepare("DELETE FROM albums WHERE id = ?").run(response.body.album.id);
  });

  it("3. PATCH /api/albums/:id renames an album", async () => {
    const response = await request(app)
      .patch(`/api/albums/${albumId}`)
      .send({ name: "Renamed Test Album" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Album updated successfully");
    expect(response.body.album.name).toBe("Renamed Test Album");
  });

  it("4. PATCH /api/albums/:id returns 404 for a missing album", async () => {
    const response = await request(app)
      .patch("/api/albums/999999999")
      .send({ name: "Missing Album" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Album not found");
  });

  it("5. POST /api/albums rejects an invalid album name", async () => {
    const response = await request(app).post("/api/albums").send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it("6. DELETE /api/albums/:id deletes an album", async () => {
    const result = db
      .prepare("INSERT INTO albums (name, description) VALUES (?, ?)")
      .run("Album To Delete", "Temporary test record");

    const idToDelete = Number(result.lastInsertRowid);

    const response = await request(app).delete(`/api/albums/${idToDelete}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Album deleted successfully");

    const deletedAlbum = db
      .prepare("SELECT id FROM albums WHERE id = ?")
      .get(idToDelete);

    expect(deletedAlbum).toBeUndefined();
  });
});
