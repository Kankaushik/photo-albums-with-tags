import { Router } from "express";

import {
  createAlbumShare,
  getSharedAlbum,
  getSharedThumbnail,
  revokeAlbumShare,
} from "../controllers/share.controller.js";

const router = Router();

router.post("/albums/:id/share", createAlbumShare);
router.delete("/albums/:id/share", revokeAlbumShare);

router.get("/shared/:token", getSharedAlbum);
router.get("/shared/:token/photos/:photoId/thumbnail", getSharedThumbnail);

export default router;
