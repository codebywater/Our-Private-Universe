import { z } from "zod";

function isRealCalendarDate(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  if (y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/** Календарная дата YYYY-MM-DD (без времени и часового пояса). */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату")
  .refine(isRealCalendarDate, "Такой даты не существует");

export const uuidSchema = z.uuid("Некорректный идентификатор");

/** Необязательный текст: пустая строка → null, пробелы по краям срезаются. */
export const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : null;
    });

export const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label}: обязательное поле`)
    .max(max, `Не длиннее ${max} символов`);

export const idInputSchema = z.strictObject({ id: uuidSchema });

/** Курсор keyset-пагинации (строго проверяется: значения попадают в фильтр БД). */
export const dateCursorSchema = z.strictObject({
  date: dateOnlySchema,
  id: uuidSchema,
});
export type DateCursor = z.infer<typeof dateCursorSchema>;
