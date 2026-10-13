"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { updateMemory } from "@/lib/actions/memories";
import type { MemoryItem } from "@/lib/data/memories";
import {
  memoryFieldsSchema,
  type MemoryFormOutput,
  type MemoryFormValues,
} from "@/lib/validations/memory";

type Props = {
  memory: MemoryItem | null;
  categories: string[];
  onClose: () => void;
  onSaved: (patch: Pick<MemoryItem, "id" | "title" | "caption" | "memoryDate" | "category">) => void;
};

export function MemoryFormDialog({ memory, categories, onClose, onSaved }: Props) {
  return (
    <Modal
      open={memory !== null}
      onClose={onClose}
      title="Редактировать воспоминание"
      description="Изменить название, описание, дату и категорию."
    >
      {memory ? (
        <EditForm
          key={memory.id}
          memory={memory}
          categories={categories}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Modal>
  );
}

function EditForm({
  memory,
  categories,
  onClose,
  onSaved,
}: {
  memory: MemoryItem;
  categories: string[];
  onClose: () => void;
  onSaved: Props["onSaved"];
}) {
  const toast = useToast();
  const listId = useId();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MemoryFormValues, unknown, MemoryFormOutput>({
    resolver: zodResolver(memoryFieldsSchema),
    defaultValues: {
      title: memory.title,
      caption: memory.caption ?? "",
      memoryDate: memory.memoryDate,
      category: memory.category,
    },
  });

  async function onSubmit(values: MemoryFormOutput) {
    setServerError(null);
    const result = await updateMemory({
      id: memory.id,
      title: values.title,
      caption: values.caption,
      memoryDate: values.memoryDate,
      category: values.category,
    });

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          if (field in values) {
            setError(field as keyof MemoryFormValues, { message });
          }
        }
      }
      setServerError(result.error);
      return;
    }

    onSaved({
      id: memory.id,
      title: values.title,
      caption: values.caption,
      memoryDate: values.memoryDate,
      category: values.category,
    });
    toast.success("Изменения сохранены");
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {serverError ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {serverError}
        </p>
      ) : null}

      <Field label="Название" htmlFor="mem-title" error={errors.title?.message}>
        <Input
          id="mem-title"
          maxLength={120}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "mem-title-error" : undefined}
          {...register("title")}
        />
      </Field>

      <Field label="Описание" htmlFor="mem-caption" error={errors.caption?.message}>
        <Textarea
          id="mem-caption"
          maxLength={2000}
          aria-invalid={Boolean(errors.caption)}
          {...register("caption")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Дата" htmlFor="mem-date" error={errors.memoryDate?.message}>
          <Input
            id="mem-date"
            type="date"
            aria-invalid={Boolean(errors.memoryDate)}
            {...register("memoryDate")}
          />
        </Field>

        <Field label="Категория" htmlFor="mem-category" error={errors.category?.message}>
          <Input
            id="mem-category"
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
