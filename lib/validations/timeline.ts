import { z } from "zod";
import {
  dateOnlySchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "@/lib/validations/common";
import { uploadRefSchema } from "@/lib/validations/upload";

export const timelineFieldsSchema = z.object({
  title: requiredText("Название", 120),
  eventDate: dateOnlySchema,
  description: optionalText(4000),
  location: optionalText(120),
});

export const createEventSchema = timelineFieldsSchema.safeExtend({
  cover: uploadRefSchema.nullish(),
});

export const updateEventSchema = timelineFieldsSchema.safeExtend({
  id: uuidSchema,
  /** Новая обложка (заменяет старую). */
  cover: uploadRefSchema.nullish(),
  /** Убрать обложку совсем. */
  removeCover: z.boolean().optional(),
});

export type EventFormValues = z.input<typeof timelineFieldsSchema>;
export type EventFormOutput = z.output<typeof timelineFieldsSchema>;
export type CreateEventInput = z.input<typeof createEventSchema>;
export type UpdateEventInput = z.input<typeof updateEventSchema>;
