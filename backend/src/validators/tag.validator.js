import { z } from "zod";

export const photoTagsSchema = z.object({
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag cannot be empty")
        .max(30, "Tag must be 30 characters or fewer")
        .regex(
          /^[a-zA-Z0-9 _-]+$/,
          "Tags can contain letters, numbers, spaces, hyphens, and underscores only",
        ),
    )
    .max(20, "A photo can have at most 20 tags"),
});
