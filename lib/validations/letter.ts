import { z } from "zod";
import { requiredText, uuidSchema } from "@/lib/validations/common";

export const LETTER_BODY_MAX = 20000;
const MAX_YEARS_AHEAD = 100;

/** Поля, которые пользователь заполняет в форме письма. */
export const letterFieldsSchema = z.object({
  title: requiredText("Заголовок", 120),
  body: z.string().max(LETTER_BODY_MAX, `Не длиннее ${LETTER_BODY_MAX} символов`),
  /** ISO-момент (UTC) открытия; null — открыть сразу после отправки. */
  openAt: z.iso
    .datetime({ offset: true, error: "Некорректная дата открытия" })
    .nullish()
    .refine(
      (v) => {
        if (!v) return true;
        const limit = Date.now() + MAX_YEARS_AHEAD * 365 * 24 * 3600 * 1000;
        return new Date(v).getTime() <= limit;
      },
      "Слишком далёкая дата",
    ),
});

/**
 * Вход действия «сохранить письмо».
 *
 * Намеренно НЕТ полей sender_id / recipient_id / status / sent_at / opened_at:
 *  - автор всегда берётся из сессии;
 *  - получатель определяется на сервере (второй участник allowlist);
 *  - strictObject отклоняет любую попытку передать лишние поля
 *    (защита от mass assignment).
 */
export const saveLetterSchema = letterFieldsSchema
  .safeExtend({
    id: uuidSchema.optional(),
    /** true — запечатать и отправить, false — сохранить черновик. */
    send: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.send && value.body.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "Напишите текст письма перед отправкой",
      });
    }
  });

export const letterFormSchema = letterFieldsSchema;

export type LetterFormValues = z.input<typeof letterFieldsSchema>;
export type SaveLetterInput = z.input<typeof saveLetterSchema>;
