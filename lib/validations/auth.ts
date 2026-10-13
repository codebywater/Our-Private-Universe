import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Введите email")
  .max(254, "Слишком длинный адрес")
  .pipe(z.email("Введите корректный email"));

/** Пароль не нормализуем (пробелы допустимы), только ограничиваем длину. */
export const passwordSchema = z
  .string()
  .min(1, "Введите пароль")
  .max(200, "Слишком длинный пароль");

/** Вход (сервер): строгая схема, лишних полей нет. */
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  next: z.string().max(500).optional(),
});

export const loginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginFormValues = z.input<typeof loginFormSchema>;
