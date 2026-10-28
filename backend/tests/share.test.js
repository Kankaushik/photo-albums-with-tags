import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import db from "../src/db/database.js";

describe("Stillroom Album Sharing API", () => {
  let albumId;
  let shareToken;

  beforeAll(() => {
    const result = db
      .prepare("INSERT INTO albums (name, description) VALUES (?, ?)")
      .run("Sharing API Test Album", "Temporary test album");

    albumId = Number(result.lastInsertRowid);
  });

  afterAll(() => {
    if (albumId) {
      db.prepare("DELETE FROM albums WHERE id = ?").run(albumId);
    }
  });

  it("1. Creates a share link", async () => {
    const response = await request(app).post(`/api/albums/${albumId}/share`);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Share link created successfully.");
    expect(response.body.album_id).toBe(albumId);
    expect(response.body.token).toBeTruthy();
    expect(response.body.share_url).toContain(`/shared/${response.body.token}`);

    shareToken = response.body.token;
  });

  it("2. Opens a shared album", async () => {
    if (!shareToken) {
      const created = await request(app).post(`/api/albums/${albumId}/share`);

      shareToken = created.body.token;
    }

    const response = await request(app).get(`/api/shared/${shareToken}`);

    expect(response.status).toBe(200);
    expect(response.body.album.id).toBe(albumId);
    expect(response.body.album.name).toBe("Sharing API Test Album");
    expect(response.body.photos).toBeInstanceOf(Array);
    expect(response.headers["cache-control"]).toContain("no-store");
  });

  it("3. Rejects an invalid share token", async () => {
    const response = await request(app).get("/api/shared/invalid-token");

    expect(response.status).toBe(404);
    expect(response.body.error).toContain("invalid or has been revoked");
  });

  it("4. Revokes an active share link", async () => {
    const response = await request(app).delete(`/api/albums/${albumId}/share`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Share link revoked successfully.");
  });

  it("5. Rejects a revoked share link", async () => {
    const response = await request(app).get(`/api/shared/${shareToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toContain("invalid or has been revoked");
  });

  it("6. Rejects revoking when no active link exists", async () => {
    const response = await request(app).delete(`/api/albums/${albumId}/share`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe(
      "No active share link exists for this album.",
    );
  });
});
