import "server-only";
import { getMembers, requireMember } from "@/lib/auth/session";
import { SIGNED_URL_TTL, signUrls } from "@/lib/data/media";
import { createClient } from "@/lib/supabase/server";
import { dateCursorSchema, type DateCursor } from "@/lib/validations/common";

export const MEMORIES_PAGE_SIZE = 18;

export type MemoryItem = {
  id: string;
  title: string;
  caption: string | null;
  memoryDate: string;
  category: string;
  width: number | null;
  height: number | null;
  /** Временная ссылка на превью (или на оригинал, если превью нет). */
  thumbUrl: string | null;
  authorName: string | null;
  createdAt: string;
};

export type MemoriesPage = {
  items: MemoryItem[];
  nextCursor: DateCursor | null;
};

/**
 * Страница воспоминаний (keyset-пагинация по (memory_date desc, id desc)).
 * Права проверяются здесь, а не только в странице-вызывающем.
 */
export async function fetchMemoriesPage(opts: {
  category?: string;
  year?: number;
  cursor?: DateCursor | null;
}): Promise<MemoriesPage> {
  await requireMember("/memories");
  const supabase = await createClient();
  const members = await getMembers();
  const names = new Map(members.map((m) => [m.id, m.displayName]));

  let query = supabase
    .from("memories")
    .select("*")
    .order("memory_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(MEMORIES_PAGE_SIZE + 1);

  if (opts.category) query = query.eq("category", opts.category);
  if (opts.year !== undefined) {
    const y = Math.trunc(opts.year);
    if (y >= 1900 && y <= 2200) {
      query = query.gte("memory_date", `${y}-01-01`).lte("memory_date", `${y}-12-31`);
    }
  }

  if (opts.cursor) {
    // Значения повторно строго проверяются: они попадают в строку фильтра.
    const c = dateCursorSchema.parse(opts.cursor);
    query = query.or(
      `memory_date.lt.${c.date},and(memory_date.eq.${c.date},id.lt.${c.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error("memories_query_failed", { cause: { code: error.code } });

  const rows = data ?? [];
  const hasMore = rows.length > MEMORIES_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, MEMORIES_PAGE_SIZE) : rows;

  const urls = await signUrls(
    supabase,
    pageRows.map((r) => r.thumb_path ?? r.image_path),
    SIGNED_URL_TTL.thumb,
  );

  const items: MemoryItem[] = pageRows.map((r) => ({
    id: r.id,
    title: r.title,
    caption: r.caption,
    memoryDate: r.memory_date,
    category: r.category,
    width: r.width,
    height: r.height,
    thumbUrl: urls.get(r.thumb_path ?? r.image_path) ?? null,
    authorName: r.created_by ? (names.get(r.created_by) ?? null) : null,
    createdAt: r.created_at,
  }));

  const last = pageRows.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? { date: last.memory_date, id: last.id } : null,
  };
}

/** Категории, которые уже используются (для фильтра и подсказок). */
export async function fetchMemoryCategories(): Promise<string[]> {
  await requireMember("/memories");
  const supabase = await createClient();
  const { data } = await supabase.from("memories").select("category").limit(5000);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .map(([name]) => name);
}

/** Временная ссылка на оригинал — только после проверки прав и существования записи. */
export async function fetchMemoryOriginalUrl(id: string): Promise<string | null> {
  await requireMember("/memories");
  const supabase = await createClient();
  const { data } = await supabase
    .from("memories")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const urls = await signUrls(supabase, [data.image_path], SIGNED_URL_TTL.original);
  return urls.get(data.image_path) ?? null;
}

/** Годы, за которые есть воспоминания (для фильтра), от новых к старым. */
export async function fetchMemoryYears(): Promise<number[]> {
  await requireMember("/memories");
  const supabase = await createClient();
  const { data } = await supabase.from("memories").select("memory_date").limit(5000);
  const years = new Set<number>();
  for (const row of data ?? []) years.add(Number(row.memory_date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}
