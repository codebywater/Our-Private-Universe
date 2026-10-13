"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signInWithPassword } from "@/lib/actions/auth";
import { loginFormSchema, type LoginFormValues } from "@/lib/validations/auth";

const ERROR_MESSAGES: Record<string, string> = {
  config: "Сервер ещё не подключён к Supabase. Заполните .env.local (см. README).",
};

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [formError, setFormError] = useState<string | null>(
    initialError ? (ERROR_MESSAGES[initialError] ?? null) : null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<LoginFormValues, unknown, z.output<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  function onSubmit(values: z.output<typeof loginFormSchema>) {
    setFormError(null);
    startTransition(async () => {
      const result = await signInWithPassword({ ...values, next });
      // При успехе действие делает redirect(), сюда управление не вернётся.
      if (result && !result.ok) {
        setFormError(result.error);
        form.resetField("password");
      }
    });
  }

  return (
    <div className="w-full">
      {formError ? (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {formError}
        </p>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoFocus
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
        </Field>

        <Field label="Пароль" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-12"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:text-text"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" loading={pending}>
          Войти
        </Button>
      </form>
    </div>
  );
}
