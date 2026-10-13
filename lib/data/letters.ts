import "server-only";
import { getMembers, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** draft — черновик; sealed — отправлено, но ещё запечатано до open_at;
 *  delivered — доступно получателю, но не открыто; opened — прочитано. */
export type LetterState = "draft" | "sealed" | "delivered" | "opened";

export type OutgoingLetter = {
  id: string;
  title: string;
  body: string;
  recipientName: string;
  state: LetterState;
  openAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Автор может править и удалять, пока письмо не открыто. */
  editable: boolean;
};

export type IncomingLetter = {
  id: string;
  senderName: string;
  /** Заголовок виден только у уже открытых писем. */
  title: string | null;
  sentAt: string | null;
  openAt: string | null;
  openedAt: string | null;
  /** false — письмо запечатано, содержимое недоступно даже на уровне БД. */
  unlocked: boolean;
};

export type LettersOverview = {
  /** Время сервера: от него считается обратный отсчёт в интерфейсе. */
  serverNow: string;
  myName: string;
  partnerName: string | null;
  incoming: IncomingLetter[];
  outgoing: OutgoingLetter[];
};

function outgoingState(
  status: "draft" | "sent",
  openAt: string | null,
  openedAt: string | null,
  now: number,
): LetterState {
  if (status === "draft") return "draft";
  if (openedAt) return "opened";
  if (openAt && new Date(openAt).getTime() > now) return "sealed";
  return "delivered";
}

export async function fetchLettersOverview(): Promise<LettersOverview> {
  const me = await requireMember("/letters");
  const supabase = await createClient();
  const members = await getMembers();
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const partner = members.find((m) => !m.isMe) ?? null;
  const now = Date.now();

  const [unlockedRes, sealedRes, outgoingRes] = await Promise.all([
    // Только метаданные: тексты писем не отправляются в список.
    // Строки будущих писем БД получателю вообще не отдаёт (RLS).
    supabase
      .from("letters")
      .select("id, title, sender_id, open_at, sent_at, opened_at")
      .eq("recipient_id", me.id)
      .order("sent_at", { ascending: false })
      .limit(500),
    // Запечатанные: только отправитель и дата открытия — без заголовка и текста.
    supabase.rpc("list_sealed_letters"),
    supabase
      .from("letters")
      .select("*")
      .eq("sender_id", me.id)
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  if (unlockedRes.error || sealedRes.error || outgoingRes.error) {
    throw new Error("letters_query_failed", {
      cause: {
        code: unlockedRes.error?.code ?? sealedRes.error?.code ?? outgoingRes.error?.code,
      },
    });
  }

  const unlocked: IncomingLetter[] = (unlockedRes.data ?? []).map((l) => ({
    id: l.id,
    senderName: names.get(l.sender_id) ?? "Без имени",
    title: l.opened_at ? l.title : null,
    sentAt: l.sent_at,
    openAt: l.open_at,
    openedAt: l.opened_at,
    unlocked: true,
  }));

  const sealed: IncomingLetter[] = (sealedRes.data ?? []).map((l) => ({
    id: l.id,
    senderName: names.get(l.sender_id) ?? "Без имени",
    title: null,
    sentAt: l.sent_at,
    openAt: l.open_at,
    openedAt: null,
    unlocked: false,
  }));

  const outgoing: OutgoingLetter[] = (outgoingRes.data ?? []).map((l) => {
    const state = outgoingState(l.status, l.open_at, l.opened_at, now);
    return {
      id: l.id,
      title: l.title,
      body: l.body,
      recipientName: names.get(l.recipient_id) ?? "Без имени",
      state,
      openAt: l.open_at,
      sentAt: l.sent_at,
      openedAt: l.opened_at,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
      editable: state !== "opened",
    };
  });

  return {
    serverNow: new Date(now).toISOString(),
    myName: me.displayName,
    partnerName: partner?.displayName ?? null,
    incoming: [...sealed, ...unlocked],
    outgoing,
  };
}
