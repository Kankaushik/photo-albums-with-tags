import { Router } from "express";

import {
  setPhotoTags,
  listTags,
  searchPhotos,
} from "../controllers/tag.controller.js";

const router = Router();

router.put("/photos/:id/tags", setPhotoTags);
router.get("/tags", listTags);
router.get("/photos/search", searchPhotos);

export default router;
