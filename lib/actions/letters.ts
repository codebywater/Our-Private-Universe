"use server";

import { revalidatePath } from "next/cache";
import { runAction, validationFailure } from "@/lib/actions/guard";
import { failure, success, type ActionResult } from "@/lib/actions/result";
import { getMembers } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { idInputSchema } from "@/lib/validations/common";
import { saveLetterSchema, type SaveLetterInput } from "@/lib/validations/letter";

export type OpenedLetter = {
  id: string;
  title: string;
  body: string;
  senderName: string;
  sentAt: string | null;
  openedAt: string | null;
};

/**
 * Сохранение письма (черновик или отправка).
 *
 * Защита от mass assignment: из клиента принимаются только title/body/openAt
 * (+ id и флаг send). Отправитель берётся из сессии, получатель определяется
 * на сервере как второй участник allowlist, статус и даты — логика БД.
 */
export async function saveLetter(
  input: SaveLetterInput,
): Promise<ActionResult<{ id: string; sent: boolean }>> {
  return runAction("saveLetter", async ({ member }) => {
    const parsed = saveLetterSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;

    const members = await getMembers();
    const partner = members.find((m) => !m.isMe);
    if (!partner) {
      return failure("В списке допущенных нет второго участника — письмо некому отправить.");
    }

    const supabase = await createClient();
    const openAt = data.openAt ?? null;

    if (!data.id) {
      const { data: row, error } = await supabase
        .from("letters")
        .insert({
          title: data.title,
          body: data.body,
          sender_id: member.id,
          recipient_id: partner.id,
          status: data.send ? "sent" : "draft",
          open_at: openAt,
        })
        .select("id, status")
        .single();

      if (error || !row) {
        console.error("[action:saveLetter] insert failed", { code: error?.code });
        return failure("Не удалось сохранить письмо. Попробуйте ещё раз.");
      }
      revalidatePath("/letters");
      return success({ id: row.id, sent: row.status === "sent" });
    }

    // Правка существующего: только своё и только неоткрытое (RLS это тоже гарантирует)
    const { data: current, error: readError } = await supabase
      .from("letters")
      .select("id, status, opened_at")
      .eq("id", data.id)
      .eq("sender_id", member.id)
      .maybeSingle();

    if (readError) return failure("Не удалось загрузить письмо. Попробуйте ещё раз.");
    if (!current) return failure("Письмо не найдено.", { code: "not_found" });
    if (current.opened_at) {
      return failure("Письмо уже открыто — изменить его нельзя.");
    }

    // Отправленное письмо нельзя вернуть в черновики
    const nextStatus = current.status === "sent" || data.send ? "sent" : "draft";
    if (nextStatus === "sent" && data.body.trim().length === 0) {
      return failure("Проверьте заполнение полей.", {
        fieldErrors: { body: "Напишите текст письма" },
        code: "validation",
      });
    }

    const { data: updated, error } = await supabase
      .from("letters")
      .update({
        title: data.title,
        body: data.body,
        recipient_id: partner.id,
        status: nextStatus,
        open_at: openAt,
      })
      .eq("id", data.id)
      .select("id, status");

    if (error || !updated || updated.length === 0) {
      console.error("[action:saveLetter] update failed", { code: error?.code });
      return failure("Не удалось сохранить изменения.");
    }

    revalidatePath("/letters");
    return success({ id: data.id, sent: nextStatus === "sent" });
  });
}

/**
 * Открытие письма получателем. Дату открытия проверяет БД (функция
 * open_letter): раньше срока она вернёт ошибку, и текст не покинет базу.
 */
export async function openLetter(input: {
  id: string;
}): Promise<ActionResult<OpenedLetter>> {
  return runAction("openLetter", async () => {
    const parsed = idInputSchema.safeParse(input);
    if (!parsed.success) return failure("Некорректный запрос.", { code: "validation" });

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("open_letter", { p_id: parsed.data.id });

    if (error || !data) {
      if (error?.code === "P0002") {
        return failure("Это письмо ещё запечатано или недоступно.", {
          code: "not_found",
        });
      }
      console.error("[action:openLetter] rpc failed", { code: error?.code });
      return failure("Не удалось открыть письмо. Попробуйте ещё раз.");
    }

    const members = await getMembers();
    const sender = members.find((m) => m.id === data.sender_id);

    revalidatePath("/letters");
    return success({
      id: data.id,
      title: data.title,
      body: data.body,
      senderName: sender?.displayName ?? "Без имени",
      sentAt: data.sent_at,
      openedAt: data.opened_at,
    });
  });
}

export async function deleteLetter(input: { id: string }): Promise<ActionResult> {
  return runAction("deleteLetter", async ({ member }) => {
    const parsed = idInputSchema.safeParse(input);
    if (!parsed.success) return failure("Некорректный запрос.", { code: "validation" });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("letters")
      .delete()
      .eq("id", parsed.data.id)
      .eq("sender_id", member.id)
      .select("id");

    if (error) {
      console.error("[action:deleteLetter] delete failed", { code: error.code });
      return failure("Не удалось удалить письмо. Попробуйте ещё раз.");
    }
    if (!data || data.length === 0) {
      return failure("Письмо не найдено или уже открыто — удалить его нельзя.", {
        code: "not_found",
      });
    }

    revalidatePath("/letters");
    return success();
  });
}
