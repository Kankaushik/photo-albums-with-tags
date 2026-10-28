import { z } from "zod";

export const createAlbumSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Album name is required")
    .max(100, "Album name must be 100 characters or fewer"),

  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer")
    .optional()
    .default(""),
});

export const updateAlbumSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Album name is required")
      .max(100, "Album name must be 100 characters or fewer")
      .optional(),

    description: z
      .string()
      .trim()
      .max(500, "Description must be 500 characters or fewer")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide a name or description to update",
  });
