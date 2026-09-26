import z from "zod";

export const CreateJobSchema = z.object({
  product: z.string().max(255),
  media: z.string().max(255),
  category: z.string().max(255),
});
