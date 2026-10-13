"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createEvent, updateEvent } from "@/lib/actions/timeline";
import { discardUpload } from "@/lib/actions/uploads";
import { inspectImageFile, uploadInspectedImage, type InspectedImage } from "@/lib/client/images";
import { publicEnv } from "@/lib/env";
import type { TimelineItem } from "@/lib/data/timeline";
import { ACCEPT_ATTRIBUTE } from "@/lib/uploads";
import { todayInTimezone } from "@/lib/utils/dates";
import {
  timelineFieldsSchema,
  type EventFormOutput,
  type EventFormValues,
} from "@/lib/validations/timeline";

export type EventDialogState = { mode: "create" } | { mode: "edit"; event: TimelineItem } | null;

type Props = {
  state: EventDialogState;
  onClose: () => void;
  onDone: () => void;
};

export function EventDialog({ state, onClose, onDone }: Props) {
  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      title={state?.mode === "edit" ? "Редактировать событие" : "Новое событие"}
      size="lg"
    >
      {state ? (
        <EventForm
          key={state.mode === "edit" ? state.event.id : "new"}
          event={state.mode === "edit" ? state.event : null}
          onClose={onClose}
          onDone={onDone}
        />
      ) : null}
    </Modal>
  );
}

function EventForm({
  event,
  onClose,
  onDone,
}: {
  event: TimelineItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [file, setFile] = useState<{ file: File; image: InspectedImage; preview: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues, unknown, EventFormOutput>({
    resolver: zodResolver(timelineFieldsSchema),
    defaultValues: {
      title: event?.title ?? "",
      eventDate: event?.eventDate ?? todayInTimezone(publicEnv.timezone),
      description: event?.description ?? "",
      location: event?.location ?? "",
    },
  });

  async function pick(f: File | undefined) {
    if (!f) return;
    setFileError(null);
    const res = await inspectImageFile(f);
    if (!res.ok) {
      setFileError(res.error);
      return;
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const preview = URL.createObjectURL(f);
    previewRef.current = preview;
    setFile({ file: f, image: res.image, preview });
    setRemoveCover(false);
  }

  async function onSubmit(values: EventFormOutput) {
    setServerError(null);

    let cover: Awaited<ReturnType<typeof uploadInspectedImage>> | null = null;
    if (file) {
      cover = await uploadInspectedImage(file.file, file.image);
      if (!cover.ok) {
        setServerError(cover.error);
        return;
      }
    }
    const ref = cover && cover.ok ? cover.uploaded.ref : undefined;

    const res = event
      ? await updateEvent({ id: event.id, ...values, cover: ref, removeCover: removeCover || undefined })
      : await createEvent({ ...values, cover: ref });

    if (!res.ok) {
      if (ref) await discardUpload(ref).catch(() => undefined);
      if (res.fieldErrors) {
        for (const [k, m] of Object.entries(res.fieldErrors)) {
          if (k in values) setError(k as keyof EventFormValues, { message: m });
        }
      }
      setServerError(res.error);
      return;
    }

    toast.success(event ? "Изменения сохранены" : "Событие добавлено");
    onDone();
    onClose();
  }

  const currentCover = !removeCover && !file ? event?.coverUrl : null;
  const shownCover = file?.preview ?? currentCover ?? null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {serverError ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {serverError}
        </p>
      ) : null}

      <Field label="Название" htmlFor="ev-title" error={errors.title?.message}>
        <Input id="ev-title" maxLength={120} aria-invalid={Boolean(errors.title)} {...register("title")} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Дата" htmlFor="ev-date" error={errors.eventDate?.message}>
          <Input id="ev-date" type="date" aria-invalid={Boolean(errors.eventDate)} {...register("eventDate")} />
        </Field>
        <Field label="Место (необязательно)" htmlFor="ev-loc" error={errors.location?.message}>
          <Input id="ev-loc" maxLength={120} aria-invalid={Boolean(errors.location)} {...register("location")} />
        </Field>
      </div>

      <Field label="Описание" htmlFor="ev-desc" error={errors.description?.message}>
        <Textarea id="ev-desc" maxLength={4000} aria-invalid={Boolean(errors.description)} {...register("description")} />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Обложка</span>
        {shownCover ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob/подписанный URL */}
            <img src={shownCover} alt="Обложка события" className="max-h-48 rounded-xl border border-line object-cover" />
            <button
              type="button"
              aria-label="Убрать обложку"
              onClick={() => {
                setFile(null);
                setRemoveCover(true);
              }}
              className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-ink/80 text-text hover:bg-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-muted transition focus-within:ring-2 focus-within:ring-accent/40 hover:border-accent/60 hover:text-text">
            <ImagePlus className="size-5" aria-hidden="true" />
            Выбрать изображение
            <input
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="sr-only"
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {fileError ? (
          <p role="alert" className="text-sm text-danger">
            {fileError}
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="quiet" onClick={onClose} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}
