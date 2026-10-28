import sharp from "sharp";
import exifr from "exifr";

export async function generateThumbnail(inputPath, outputPath) {
  await sharp(inputPath)
    .rotate()
    .resize({
      width: 400,
      height: 400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
}

export async function getPhotoDate(inputPath) {
  try {
    const exif = await exifr.parse(inputPath, [
      "DateTimeOriginal",
      "CreateDate",
    ]);

    const date = exif?.DateTimeOriginal ?? exif?.CreateDate;

    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date.toISOString();
    }

    if (typeof date === "string") {
      const parsed = new Date(
        date.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3"),
      );

      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  } catch {
    // Some photos do not contain readable EXIF metadata.
  }

  return null;
}
