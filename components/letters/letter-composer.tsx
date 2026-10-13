"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { saveLetter } from "@/lib/actions/letters";
import type { OutgoingLetter } from "@/lib/data/letters";
import { publicEnv } from "@/lib/env";
import { isoToZonedInput, zonedInputToIso } from "@/lib/utils/dates";
import {
  LETTER_BODY_MAX,
  letterFormSchema,
  type LetterFormValues,
} from "@/lib/validations/letter";

export type ComposerState = { letter: OutgoingLetter | null } | null;

type FormShape = { title: string; body: string; openAtLocal: string };

export function LetterComposer({
  state,
  partnerName,
  onClose,
  onDone,
}: {
  state: ComposerState;
  partnerName: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      size="lg"
      title={state?.letter ? "Редактировать письмо" : "Новое письмо"}
      description={partnerName ? `Для: ${partnerName}` : undefined}
    >
      {state ? (
        <ComposerForm
          key={state.letter?.id ?? "new"}
          letter={state.letter}
          onClose={onClose}
          onDone={onDone}
        />
      ) : null}
    </Modal>
  );
}

function ComposerForm({
  letter,
  onClose,
  onDone,
}: {
  letter: OutgoingLetter | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormShape>({
    defaultValues: {
      title: letter?.title ?? "",
      body: letter?.body ?? "",
      openAtLocal: letter?.openAt ? isoToZonedInput(letter.openAt, publicEnv.timezone) : "",
    },
  });

  async function submit(values: FormShape, send: boolean) {
    setServerError(null);

    let openAt: string | null = null;
    if (values.openAtLocal) {
      openAt = zonedInputToIso(values.openAtLocal, publicEnv.timezone);
      if (!openAt) {
        setError("openAtLocal", { message: "Некорректная дата открытия" });
        return;
      }
    }

    // Валидация общей схемой до отправки; сервер проверит ещё раз.
    const parsed = letterFormSchema.safeParse({ title: values.title, body: values.body, openAt });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "openAt" ? "openAtLocal" : (issue.path[0] as keyof FormShape);
        if (key) setError(key, { message: issue.message });
      }
      return;
    }
    if (send && values.body.trim().length === 0) {
      setError("body", { message: "Напишите текст письма перед отправкой" });
      return;
    }

    setBusy(send ? "send" : "draft");
    const res = await saveLetter({ id: letter?.id, ...parsed.data, send });
    setBusy(null);

    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [k, m] of Object.entries(res.fieldErrors)) {
          setError((k === "openAt" ? "openAtLocal" : k) as keyof FormShape, { message: m });
        }
      }
      setServerError(res.error);
      return;
    }
    toast.success(send ? "Письмо отправлено" : "Черновик сохранён");
    onDone();
    onClose();
  }

  const disabled = busy !== null;
  const wasSent = letter !== null && letter.state !== "draft";

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
      {serverError ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {serverError}
        </p>
      ) : null}

      <Field label="Заголовок" htmlFor="lt-title" error={errors.title?.message}>
        <Input id="lt-title" maxLength={120} aria-invalid={Boolean(errors.title)} {...register("title")} />
      </Field>

      <Field label="Письмо" htmlFor="lt-body" error={errors.body?.message}>
        <Textarea
          id="lt-body"
          maxLength={LETTER_BODY_MAX}
          className="min-h-56 font-display text-xl leading-relaxed"
          aria-invalid={Boolean(errors.body)}
          {...register("body")}
        />
      </Field>

      <Field
        label="Открыть не раньше (необязательно)"
        htmlFor="lt-open"
        error={errors.openAtLocal?.message}
        hint={`Время по поясу ${publicEnv.timezone}. До этой даты текст недоступен получателю — это проверяется на сервере.`}
      >
        <Input
          id="lt-open"
          type="datetime-local"
          aria-invalid={Boolean(errors.openAtLocal)}
          {...register("openAtLocal")}
        />
      </Field>

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="quiet" onClick={onClose} disabled={disabled}>
          Отмена
        </Button>
        {!wasSent ? (
          <Button
            variant="ghost"
            loading={busy === "draft"}
            disabled={disabled}
            onClick={handleSubmit((v) => submit(v, false))}
          >
            Сохранить черновик
          </Button>
        ) : null}
        <Button loading={busy === "send"} disabled={disabled} onClick={handleSubmit((v) => submit(v, true))}>
          {wasSent ? "Сохранить" : "Запечатать и отправить"}
        </Button>
      </div>
    </form>
  );
}

export type { LetterFormValues };
