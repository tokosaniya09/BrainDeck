import { z } from 'zod';

export const GenerateSchema = z.object({
  topic: z.string()
    .trim()
    .min(2, "Topic is too short")
    .max(200, "Topic is too long (max 200 characters)")
    .refine((val) => {
      const lower = val.toLowerCase();
      const suspicious = ["ignore previous", "system prompt", "reveal your instructions"];
      return !suspicious.some(pattern => lower.includes(pattern));
    }, "Invalid topic detected. Please provide a clear educational topic.")
});

export type GenerateInput = z.infer<typeof GenerateSchema>;
