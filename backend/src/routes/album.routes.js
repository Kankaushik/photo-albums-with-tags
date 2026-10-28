import { Router } from "express";

import {
  listAlbums,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  setAlbumCover,
} from "../controllers/album.controller.js";

const router = Router();

router.get("/", listAlbums);
router.post("/", createAlbum);
router.patch("/:id", updateAlbum);
router.delete("/:id", deleteAlbum);
router.put("/:id/cover", setAlbumCover);

export default router;
