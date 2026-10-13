"use server";

import { revalidatePath } from "next/cache";
import { runAction, validationFailure } from "@/lib/actions/guard";
import { failure, success, type ActionResult } from "@/lib/actions/result";
import { removeObjects } from "@/lib/data/media";
import { UploadVerificationError, verifyUploadRef } from "@/lib/data/upload-verify";
import { createClient } from "@/lib/supabase/server";
import { idInputSchema } from "@/lib/validations/common";
import {
  createEventSchema,
  updateEventSchema,
  type CreateEventInput,
  type UpdateEventInput,
} from "@/lib/validations/timeline";

export async function createEvent(
  input: CreateEventInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction("createEvent", async ({ member }) => {
    const parsed = createEventSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;

    const supabase = await createClient();

    let cover: { imagePath: string; thumbPath: string | null } | null = null;
    if (data.cover) {
      try {
        cover = await verifyUploadRef(supabase, member, data.cover);
      } catch (error) {
        if (error instanceof UploadVerificationError) return failure(error.userMessage);
        throw error;
      }
    }

    const { data: row, error } = await supabase
      .from("timeline_events")
      .insert({
        title: data.title,
        description: data.description,
        event_date: data.eventDate,
        location: data.location,
        image_path: cover?.imagePath ?? null,
        thumb_path: cover?.thumbPath ?? null,
        created_by: member.id,
      })
      .select("id")
      .single();

    if (error || !row) {
      await removeObjects(supabase, [cover?.imagePath, cover?.thumbPath]);
      console.error("[action:createEvent] insert failed", { code: error?.code });
      return failure("Не удалось сохранить событие. Попробуйте ещё раз.");
    }

    revalidatePath("/timeline");
    revalidatePath("/archive");
    return success({ id: row.id });
  });
}

export async function updateEvent(input: UpdateEventInput): Promise<ActionResult> {
  return runAction("updateEvent", async ({ member }) => {
    const parsed = updateEventSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;

    const supabase = await createClient();

    const { data: current, error: readError } = await supabase
      .from("timeline_events")
      .select("id, image_path, thumb_path")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) return failure("Не удалось загрузить событие. Попробуйте ещё раз.");
    if (!current) return failure("Событие не найдено.", { code: "not_found" });

    let newCover: { imagePath: string; thumbPath: string | null } | null = null;
    if (data.cover) {
      try {
        newCover = await verifyUploadRef(supabase, member, data.cover);
      } catch (error) {
        if (error instanceof UploadVerificationError) return failure(error.userMessage);
        throw error;
      }
    }

    const coverPatch = newCover
      ? { image_path: newCover.imagePath, thumb_path: newCover.thumbPath }
      : data.removeCover
        ? { image_path: null, thumb_path: null }
        : {};

    const { data: updated, error } = await supabase
      .from("timeline_events")
      .update({
        title: data.title,
        description: data.description,
        event_date: data.eventDate,
        location: data.location,
        ...coverPatch,
      })
      .eq("id", data.id)
      .select("id");

    if (error || !updated || updated.length === 0) {
      await removeObjects(supabase, [newCover?.imagePath, newCover?.thumbPath]);
      console.error("[action:updateEvent] update failed", { code: error?.code });
      return failure("Не удалось сохранить изменения.");
    }

    // Старая обложка больше не нужна (best effort: запись уже обновлена)
    if (newCover || data.removeCover) {
      await removeObjects(supabase, [current.image_path, current.thumb_path]);
    }

    revalidatePath("/timeline");
    return success();
  });
}

export async function deleteEvent(input: { id: string }): Promise<ActionResult> {
  return runAction("deleteEvent", async () => {
    const parsed = idInputSchema.safeParse(input);
    if (!parsed.success) return failure("Некорректный запрос.", { code: "validation" });

    const supabase = await createClient();
    const { data: row, error: readError } = await supabase
      .from("timeline_events")
      .select("id, image_path, thumb_path")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (readError) return failure("Не удалось найти событие. Попробуйте ещё раз.");
    if (!row) return failure("Событие уже удалено.", { code: "not_found" });

    const removed = await removeObjects(supabase, [row.image_path, row.thumb_path]);
    if (!removed.ok) {
      return failure(
        "Не удалось удалить обложку из хранилища. Событие сохранено — попробуйте ещё раз.",
      );
    }

    const { error } = await supabase.from("timeline_events").delete().eq("id", row.id);
    if (error) {
      console.error("[action:deleteEvent] delete failed", { code: error.code });
      return failure("Обложка удалена, но запись не удалась. Повторите удаление.");
    }

    revalidatePath("/timeline");
    revalidatePath("/archive");
    return success();
  });
}
