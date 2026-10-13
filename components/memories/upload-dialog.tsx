"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RotateCw,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createMemory } from "@/lib/actions/memories";
import { discardUpload } from "@/lib/actions/uploads";
import {
  inspectImageFile,
  titleFromFilename,
  uploadInspectedImage,
  type InspectedImage,
} from "@/lib/client/images";
import { publicEnv } from "@/lib/env";
import { DEFAULT_MEMORY_CATEGORY } from "@/lib/site-config";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES_PER_BATCH,
  formatBytes,
} from "@/lib/uploads";
import { cn } from "@/lib/utils/cn";
import { todayInTimezone } from "@/lib/utils/dates";
import {
  memoryFieldsSchema,
  type MemoryFormOutput,
  type MemoryFormValues,
} from "@/lib/validations/memory";

type ItemStatus = "inspecting" | "ready" | "uploading" | "saving" | "done" | "error";

type UploadItem = {
  key: string;
  file: File;
  previewUrl: string;
  title: string;
  status: ItemStatus;
  error?: string;
  image?: InspectedImage;
};

const CONCURRENCY = 2;

type Props = {
  open: boolean;
  categories: string[];
  onClose: () => void;
  /** Вызывается, когда хотя бы одна фотография сохранена. */
  onUploaded: (count: number) => void;
};

export function UploadDialog({ open, categories, onClose, onUploaded }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить воспоминания"
      description="Перетащите фотографии или выберите их на устройстве."
      size="lg"
    >
      <UploadForm categories={categories} onClose={onClose} onUploaded={onUploaded} />
    </Modal>
  );
}

function UploadForm({
  categories,
  onClose,
  onUploaded,
}: Omit<Props, "open">) {
  const toast = useToast();
  const inputId = useId();
  const listId = useId();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const itemsRef = useRef<UploadItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Освобождаем object URL предпросмотров при закрытии окна
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MemoryFormValues, unknown, MemoryFormOutput>({
    // Название задаётся для каждого файла отдельно — в общей форме его нет.
    resolver: zodResolver(memoryFieldsSchema.omit({ title: true })) as never,
    defaultValues: {
      title: "",
      caption: "",
      memoryDate: todayInTimezone(publicEnv.timezone),
      category: DEFAULT_MEMORY_CATEGORY,
    },
  });

  const patch = (key: string, changes: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    const room = MAX_FILES_PER_BATCH - items.length;
    if (room <= 0) {
      toast.info(`За один раз можно добавить не больше ${MAX_FILES_PER_BATCH} фотографий.`);
      return;
    }
    if (incoming.length > room) {
      toast.info(`Добавлены первые ${room} из ${incoming.length} файлов (лимит ${MAX_FILES_PER_BATCH}).`);
    }

    const fresh: UploadItem[] = incoming.slice(0, room).map((file) => ({
      key: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      title: titleFromFilename(file.name),
      status: "inspecting",
    }));
    setItems((prev) => [...prev, ...fresh]);

    for (const item of fresh) {
      const result = await inspectImageFile(item.file);
      if (result.ok) patch(item.key, { status: "ready", image: result.image });
      else patch(item.key, { status: "error", error: result.error });
    }
  }

  function removeItem(key: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.key !== key);
    });
  }

  async function processItem(item: UploadItem, common: MemoryFormOutput): Promise<boolean> {
    if (!item.image) return false;
    patch(item.key, { status: "uploading", error: undefined });

    const uploaded = await uploadInspectedImage(item.file, item.image);
    if (!uploaded.ok) {
      patch(item.key, { status: "error", error: uploaded.error });
      return false;
    }

    patch(item.key, { status: "saving" });
    const title = item.title.trim() || titleFromFilename(item.file.name) || "Без названия";
    const saved = await createMemory({
      title,
      caption: common.caption,
      memoryDate: common.memoryDate,
      category: common.category,
      upload: uploaded.uploaded.ref,
      width: uploaded.uploaded.width,
      height: uploaded.uploaded.height,
    });

    if (!saved.ok) {
      const message = saved.fieldErrors
        ? Object.values(saved.fieldErrors).join(" ")
        : saved.error;
      // Файлы уже в Storage, а запись не создана — убираем, чтобы не копить мусор
      await discardUpload(uploaded.uploaded.ref).catch(() => undefined);
      patch(item.key, { status: "error", error: message });
      return false;
    }

    patch(item.key, { status: "done" });
    return true;
  }

  async function onSubmit(common: MemoryFormOutput) {
    const queue = items.filter(
      (it) => it.image && (it.status === "ready" || it.status === "error"),
    );
    if (queue.length === 0) {
      toast.info("Выберите хотя бы одну фотографию.");
      return;
    }

    setBusy(true);
    let done = 0;
    let cursor = 0;

    // Небольшой пул: два файла одновременно
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (cursor < queue.length) {
        const next = queue[cursor++];
        if (!next) break;
        if (await processItem(next, common)) done += 1;
      }
    });
    await Promise.all(workers);
    setBusy(false);

    if (done > 0) {
      onUploaded(done);
      toast.success(
        done === queue.length
          ? `Добавлено: ${done}`
          : `Добавлено ${done} из ${queue.length}. Остальные можно повторить.`,
      );
    }
    if (done === queue.length) onClose();
    else if (done === 0) toast.error("Не удалось загрузить фотографии. Проверьте сообщения у файлов.");
  }

  const pendingCount = items.filter(
    (it) => it.image && (it.status === "ready" || it.status === "error"),
  ).length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {/* Зона перетаскивания */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40",
          dragging
            ? "border-accent bg-accent/10"
            : "border-line-strong bg-white/[0.02] hover:border-accent/60",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <UploadCloud className="size-9 text-accent" aria-hidden="true" />
        <span className="text-base text-text">
          Перетащите фотографии сюда или <span className="text-accent underline">выберите файлы</span>
        </span>
        <span className="text-xs text-muted">
          JPEG, PNG, WebP, AVIF · до 12 МБ · не больше {MAX_FILES_PER_BATCH} за раз
        </span>
      </label>

      {/* Выбранные файлы */}
      {items.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Выбранные файлы">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-4 rounded-2xl border border-line bg-white/[0.03] p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- локальный blob-предпросмотр */}
              <img
                src={item.previewUrl}
                alt=""
                className="size-16 shrink-0 rounded-xl bg-white/5 object-cover"
              />
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor={`title-${item.key}`}>
                  Название для {item.file.name}
                </label>
                <input
                  id={`title-${item.key}`}
                  value={item.title}
                  maxLength={120}
                  disabled={busy || item.status === "done" || item.status === "inspecting"}
                  onChange={(e) => patch(item.key, { title: e.target.value })}
                  placeholder="Название"
                  className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-base text-text placeholder:text-muted/60 hover:border-line focus:border-accent/60 focus:outline-none disabled:opacity-60"
                />
                <p className="px-2 text-xs text-muted">
                  {item.file.name} · {formatBytes(item.file.size)}
                </p>
                {item.error ? (
                  <p role="alert" className="mt-1 px-2 text-xs text-danger">
                    {item.error}
                  </p>
                ) : null}
              </div>
              <StatusBadge status={item.status} />
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                disabled={busy}
                aria-label={`Убрать ${item.file.name}`}
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-text disabled:opacity-40"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Общие поля для всех файлов */}
      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={busy}>
        <legend className="sr-only">Общие данные для всех фотографий</legend>
        <Field label="Дата воспоминания" htmlFor="up-date" error={errors.memoryDate?.message}>
          <Input
            id="up-date"
            type="date"
            aria-invalid={Boolean(errors.memoryDate)}
            {...register("memoryDate")}
          />
        </Field>
        <Field label="Категория" htmlFor="up-category" error={errors.category?.message}>
          <Input
            id="up-category"
            list={listId}
            maxLength={40}
            aria-invalid={Boolean(errors.category)}
            {...register("category")}
          />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Описание (необязательно)"
          htmlFor="up-caption"
          error={errors.caption?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="up-caption"
            maxLength={2000}
            className="min-h-20"
            aria-invalid={Boolean(errors.caption)}
            {...register("caption")}
          />
        </Field>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="quiet" onClick={onClose} disabled={busy}>
          {items.some((i) => i.status === "done") ? "Закрыть" : "Отмена"}
        </Button>
        <Button type="submit" loading={busy} disabled={pendingCount === 0}>
          <ImagePlus className="size-4" aria-hidden="true" />
          {busy ? "Загружаем…" : pendingCount > 0 ? `Загрузить (${pendingCount})` : "Загрузить"}
        </Button>
      </div>
    </form>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  switch (status) {
    case "inspecting":
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Проверка
        </span>
      );
    case "uploading":
    case "saving":
      return (
        <span className="flex items-center gap-1.5 text-xs text-accent" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {status === "uploading" ? "Загрузка" : "Сохранение"}
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-1.5 text-xs text-success" role="status">
          <CheckCircle2 className="size-4" aria-hidden="true" /> Готово
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle className="size-4" aria-hidden="true" />
          <RotateCw className="hidden size-3.5" aria-hidden="true" />
          Ошибка
        </span>
      );
    default:
      return <span className="text-xs text-muted">Готово к загрузке</span>;
  }
}
