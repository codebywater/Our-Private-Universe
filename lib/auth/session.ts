import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils/safe-redirect";

export type Member = {
  id: string;
  email: string | null;
  displayName: string;
};

export type Access =
  | { status: "anonymous" }
  /** Вошёл, но не внесён в allowlist — доступа к данным нет. */
  | { status: "forbidden"; email: string | null }
  | { status: "member"; member: Member };

export class AccessDeniedError extends Error {
  constructor() {
    super("access_denied");
    this.name = "AccessDeniedError";
  }
}

/**
 * Единственный источник правды о доступе.
 *
 * 1. auth.getUser() проверяет JWT на сервере Auth (cookie недостаточно).
 * 2. Затем читается строка пользователя в allowed_users. Запрос идёт под RLS:
 *    пользователь вне allowlist не увидит там ничего, даже собственной строки,
 *    поэтому «наличие сессии» никогда не равно «наличию доступа».
 *
 * Результат кэшируется в рамках одного запроса (React cache).
 */
export const getAccess = cache(async (): Promise<Access> => {
  if (!isSupabaseConfigured) return { status: "anonymous" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const { data: row, error: rowError } = await supabase
    .from("allowed_users")
    .select("user_id, display_name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (rowError || !row) {
    return { status: "forbidden", email: data.user.email ?? null };
  }

  return {
    status: "member",
    member: {
      id: data.user.id,
      email: data.user.email ?? null,
      displayName: row.display_name,
    },
  };
});

export async function getMember(): Promise<Member | null> {
  const access = await getAccess();
  return access.status === "member" ? access.member : null;
}

/**
 * Для страниц и функций доступа к данным: без доступа — на страницу входа.
 * Вызывается в КАЖДОЙ странице и в каждой функции слоя данных, а не только в
 * layout (layout не перерисовывается при клиентской навигации).
 */
export async function requireMember(nextPath?: string): Promise<Member> {
  const access = await getAccess();
  if (access.status === "member") return access.member;

  const next = safeNextPath(nextPath, "/");
  const params = new URLSearchParams({ next });
  if (access.status === "forbidden") params.set("error", "forbidden");
  redirect(`/login?${params.toString()}`);
}

/** Для серверных действий: бросает AccessDeniedError, а не делает redirect. */
export async function requireMemberForAction(): Promise<Member> {
  const member = await getMember();
  if (!member) throw new AccessDeniedError();
  return member;
}

export type MemberName = { id: string; displayName: string; isMe: boolean };

/** Оба участника (для подписей авторов и выбора получателя письма). */
export const getMembers = cache(async (): Promise<MemberName[]> => {
  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase
    .from("allowed_users")
    .select("user_id, display_name")
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.user_id,
    displayName: r.display_name,
    isMe: r.user_id === me.id,
  }));
});
