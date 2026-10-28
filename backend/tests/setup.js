import path from "node:path";

process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = path.resolve(
  process.cwd(),
  "data",
  "photo-albums-test.db",
);
