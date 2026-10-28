import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";

import "./db/database.js";
import albumRoutes from "./routes/album.routes.js";
import photoRoutes from "./routes/photo.routes.js";
import tagRoutes from "./routes/tag.routes.js";
import shareRoutes from "./routes/share.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use("/api/albums", albumRoutes);
app.use("/api", photoRoutes);
app.use("/api", tagRoutes);
app.use("/api", shareRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Photo Albums API is running",
  });
});

// Error-handling middleware must come after the routes.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each photo must be 20 MB or smaller."
        : err.code === "LIMIT_FILE_COUNT"
          ? "Upload a maximum of 10 photos at once."
          : "The upload exceeds the allowed limits.";

    return res.status(400).json({ error: message });
  }

  if (err.message?.startsWith("Only JPEG")) {
    return res.status(400).json({ error: err.message });
  }

  console.error(err);

  return res.status(500).json({
    error: "Something went wrong while processing the request.",
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
