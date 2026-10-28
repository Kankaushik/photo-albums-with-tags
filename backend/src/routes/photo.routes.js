import { Router } from "express";
import upload from "../middleware/upload.middleware.js";

import {
  uploadPhotos,
  listAlbumPhotos,
  getPhotoThumbnail,
  deletePhoto,
} from "../controllers/photo.controller.js";

const router = Router();

router.post("/albums/:id/photos", upload.array("photos", 10), uploadPhotos);

router.get("/albums/:id/photos", listAlbumPhotos);

router.get("/photos/:id/thumbnail", getPhotoThumbnail);

router.delete("/photos/:id", deletePhoto);

export default router;
