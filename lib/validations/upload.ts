import { z } from "zod";
import {
  IMAGE_EXTENSIONS,
  MAX_IMAGE_BYTES,
  MIME_TO_EXTENSION,
} from "@/lib/uploads";
import { uuidSchema } from "@/lib/validations/common";

const allowedMimes = Object.keys(MIME_TO_EXTENSION) as [string, ...string[]];

/** Запрос на подготовку загрузки (до самой загрузки файла). */
export const prepareUploadSchema = z.strictObject({
  mime: z.enum(allowedMimes, {
    error: "Допустимы только JPEG, PNG, WebP и AVIF",
  }),
  size: z
    .number()
    .int()
    .positive("Файл пустой")
    .max(MAX_IMAGE_BYTES, "Файл слишком большой (максимум 12 МБ)"),
  withThumb: z.boolean(),
});
export type PrepareUploadInput = z.infer<typeof prepareUploadSchema>;

/**
 * Ссылка на уже загруженный файл. Клиент НЕ присылает пути: путь собирается
 * на сервере из id пользователя, uploadId и расширения.
 */
export const uploadRefSchema = z.strictObject({
  uploadId: uuidSchema,
  ext: z.enum(IMAGE_EXTENSIONS),
  hasThumb: z.boolean(),
});
export type UploadRef = z.infer<typeof uploadRefSchema>;

export const imageDimensionSchema = z.number().int().min(1).max(30000);
