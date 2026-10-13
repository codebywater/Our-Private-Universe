import { z } from "zod";
import {
  dateCursorSchema,
  dateOnlySchema,
  optionalText,
  requiredText,
  uuidSchema,
} from "@/lib/validations/common";
import { imageDimensionSchema, uploadRefSchema } from "@/lib/validations/upload";

/** Редактируемые метаданные — общая схема для формы и сервера. */
export const memoryFieldsSchema = z.object({
  title: requiredText("Название", 120),
  caption: optionalText(2000),
  memoryDate: dateOnlySchema,
  category: requiredText("Категория", 40),
});

export const createMemorySchema = memoryFieldsSchema.safeExtend({
  upload: uploadRefSchema,
  width: imageDimensionSchema.nullish(),
  height: imageDimensionSchema.nullish(),
});

export const updateMemorySchema = memoryFieldsSchema.safeExtend({
  id: uuidSchema,
});

export const listMemoriesSchema = z.strictObject({
  category: z.string().trim().min(1).max(40).optional(),
  year: z.number().int().min(1900).max(2200).optional(),
  cursor: dateCursorSchema.nullish(),
});

export type MemoryFormValues = z.input<typeof memoryFieldsSchema>;
export type MemoryFormOutput = z.output<typeof memoryFieldsSchema>;
export type CreateMemoryInput = z.input<typeof createMemorySchema>;
export type UpdateMemoryInput = z.input<typeof updateMemorySchema>;
