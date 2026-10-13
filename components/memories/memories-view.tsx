"use client";

import { ImagePlus, Loader2, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { deleteMemory, loadMoreMemories } from "@/lib/actions/memories";
import type { MemoriesPage, MemoryItem } from "@/lib/data/memories";
import { formatDateRu } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { MemoryFormDialog } from "./memory-form-dialog";
import { MemoryLightbox } from "./memory-lightbox";
import { UploadDialog } from "./upload-dialog";

type Props = {
  initial: MemoriesPage;
  categories: string[];
  years: number[];
};

export function MemoriesView({ initial, categories: initialCategories, years: initialYears }: Props) {
  const toast = useToast();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [year, setYear] = useState<number | null>(null);
  const [years, setYears] = useState(initialYears);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [editing, setEditing] = useState<MemoryItem | null>(null);
  const [deleting, setDeleting] = useState<MemoryItem | null>(null);

  const sentinel = useRef<HTMLDivElement>(null);
  // Защита от гонок: ответ устаревшего запроса (после смены фильтра) игнорируется
  const requestId = useRef(0);

  const fetchPage = useCallback(
    async (
      cat: string | null,
      yr: number | null,
      from: MemoriesPage["nextCursor"],
      replace: boolean,
    ) => {
      const id = ++requestId.current;
      setLoading(true);
      setLoadError(false);
      const res = await loadMoreMemories({
        category: cat ?? undefined,
        year: yr ?? undefined,
        cursor: from,
      });
      if (id !== requestId.current) return;
      setLoading(false);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setItems((prev) => (replace ? res.data.items : [...prev, ...res.data.items]));
      setCursor(res.data.nextCursor);
    },
    [],
  );

  function applyFilter(nextCat: string | null, nextYear: number | null) {
    if (nextCat === category && nextYear === year) return;
    setCategory(nextCat);
    setYear(nextYear);
    setItems([]);
    setCursor(null);
    void fetchPage(nextCat, nextYear, null, true);
  }
  const selectCategory = (next: string | null) => applyFilter(next, year);
  const selectYear = (next: number | null) => applyFilter(category, next);

  // Бесконечная прокрутка
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || loading || loadError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchPage(category, year, cursor, false);
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loading, loadError, category, year, fetchPage]);

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    const res = await deleteMemory({ id: target.id });
    // «Уже удалено» тоже считаем успехом — убираем из списка
    if (res.ok || res.code === "not_found") {
      setItems((prev) => prev.filter((m) => m.id !== target.id));
      setLightbox(null);
      setDeleting(null);
      toast.success("Воспоминание удалено");
    } else {
      toast.error(res.error);
    }
  }

  const empty = !loading && !loadError && items.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Воспоминания"
        title="Всё, что мы сохранили"
        description="Фотографии и мгновения в том порядке, в каком они случались."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <ImagePlus className="size-4" aria-hidden="true" />
            Добавить
          </Button>
        }
      />

      {years.length > 1 ? (
        <div role="group" aria-label="Фильтр по году" className="-mx-1 mb-3 flex flex-wrap gap-2">
          <Chip active={year === null} onClick={() => selectYear(null)}>
            Все годы
          </Chip>
          {years.map((y) => (
            <Chip key={y} active={year === y} onClick={() => selectYear(y)}>
              <span className="font-mono">{y}</span>
            </Chip>
          ))}
        </div>
      ) : null}

      {categories.length > 0 ? (
        <div
          role="group"
          aria-label="Фильтр по категории"
          className="-mx-1 mb-10 flex flex-wrap gap-2"
        >
          <Chip active={category === null} onClick={() => selectCategory(null)}>
            Все
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => selectCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      ) : null}

      {empty ? (
        <EmptyState
          icon={<ImagePlus className="size-7" aria-hidden="true" />}
          title={category ? "В этой категории пока пусто" : "Здесь начнёт собираться наша история"}
          description={
            category ? "Выберите другую категорию или добавьте фотографию." : "Добавьте первую фотографию."
          }
          action={<Button onClick={() => setUploadOpen(true)}>Добавить воспоминание</Button>}
        />
      ) : (
        <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>li]:mb-5">
          {items.map((m, i) => (
            <Reveal as="li" key={m.id} y={20} className="break-inside-avoid">
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="group relative block w-full overflow-hidden rounded-2xl border border-line bg-ink-2 text-left"
                aria-label={`Открыть: ${m.title}`}
              >
                {m.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- подписанный URL
                  <img
                    src={m.thumbUrl}
                    alt={m.caption ?? m.title}
                    loading="lazy"
                    decoding="async"
                    width={m.width ?? undefined}
                    height={m.height ?? undefined}
                    style={m.width && m.height ? { aspectRatio: `${m.width} / ${m.height}` } : undefined}
                    className="h-auto w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center text-sm text-muted">
                    Нет превью
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/50 to-transparent p-4 pt-12">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                    {formatDateRu(m.memoryDate)}
                  </p>
                  <p className="mt-1 font-display text-xl text-text">{m.title}</p>
                </div>
              </button>
            </Reveal>
          ))}
          {loading
            ? Array.from({ length: 3 }, (_, i) => (
                <li key={`sk-${i}`} aria-hidden="true">
                  <Skeleton className={cn("w-full rounded-2xl", i % 2 ? "h-72" : "h-56")} />
                </li>
              ))
            : null}
        </ul>
      )}

      {loadError ? (
        <div role="alert" className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted">Не удалось загрузить фотографии.</p>
          <Button variant="ghost" size="sm" onClick={() => void fetchPage(category, year, cursor, items.length === 0)}>
            <RotateCw className="size-4" aria-hidden="true" /> Повторить
          </Button>
        </div>
      ) : null}

      {loading && items.length > 0 ? (
        <p className="mt-6 flex justify-center text-accent" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          <span className="sr-only">Загрузка…</span>
        </p>
      ) : null}

      {/* Для клавиатуры и скринридеров: явная кнопка вместо только автоподгрузки */}
      {cursor && !loading && !loadError ? (
        <div ref={sentinel} className="mt-10 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => void fetchPage(category, year, cursor, false)}>
            Показать ещё
          </Button>
        </div>
      ) : null}

      <UploadDialog
        open={uploadOpen}
        categories={categories}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          // Свежие данные с сервера: заново грузим первую страницу
          void fetchPage(category, year, null, true);
        }}
      />

      <MemoryLightbox
        items={items}
        index={lightbox}
        onIndexChange={setLightbox}
        onEdit={(m) => setEditing(m)}
        onDelete={(m) => setDeleting(m)}
      />

      <MemoryFormDialog
        memory={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={(patch) => {
          setItems((prev) => prev.map((m) => (m.id === patch.id ? { ...m, ...patch } : m)));
          setCategories((prev) => (prev.includes(patch.category) ? prev : [...prev, patch.category]));
          const y = Number(patch.memoryDate.slice(0, 4));
          setYears((prev) => (prev.includes(y) ? prev : [...prev, y].sort((a, b) => b - a)));
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Удалить воспоминание?"
        message={`«${deleting?.title ?? ""}» будет удалено вместе с фотографией. Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition",
        active
          ? "border-accent bg-accent/15 text-text"
          : "border-line text-muted hover:border-accent/50 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
