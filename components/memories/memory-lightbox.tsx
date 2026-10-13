"use client";

import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMemoryOriginalUrl } from "@/lib/actions/memories";
import type { MemoryItem } from "@/lib/data/memories";
import { formatDateRu } from "@/lib/utils/dates";

type Props = {
  items: MemoryItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onEdit: (item: MemoryItem) => void;
  onDelete: (item: MemoryItem) => void;
};

/**
 * Полноэкранный просмотр. Оригинал запрашивается лениво при открытии кадра
 * (подписанная ссылка на 10 минут), пока показывается превью.
 */
export function MemoryLightbox({ items, index, onIndexChange, onEdit, onDelete }: Props) {
  const open = index !== null;
  const item = index !== null ? (items[index] ?? null) : null;

  const [original, setOriginal] = useState<{ id: string; url: string } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const lastFocus = useRef<Element | null>(null);

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = index + delta;
      if (next >= 0 && next < items.length) onIndexChange(next);
    },
    [index, items.length, onIndexChange],
  );

  // Ленивая загрузка оригинала текущего кадра
  const itemId = item?.id ?? null;
  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    getMemoryOriginalUrl({ id: itemId }).then((res) => {
      if (cancelled) return;
      if (res.ok) setOriginal({ id: itemId, url: res.data.url });
      else setFailedId(itemId);
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  // Клавиатура, блокировка прокрутки, возврат фокуса
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onIndexChange(null);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (lastFocus.current instanceof HTMLElement) lastFocus.current.focus();
    };
  }, [open, go, onIndexChange]);

  // Предзагрузка превью соседей
  useEffect(() => {
    if (index === null) return;
    for (const n of [items[index - 1], items[index + 1]]) {
      if (n?.thumbUrl) {
        const img = new Image();
        img.src = n.thumbUrl;
      }
    }
  }, [index, items]);

  const originalUrl = item && original?.id === item.id ? original.url : null;
  const failed = item !== null && failedId === item.id;
  const src = originalUrl ?? item?.thumbUrl ?? null;

  return (
    <AnimatePresence>
      {open && item ? (
        <motion.div
          key="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Просмотр: ${item.title}`}
          className="fixed inset-0 z-[60] flex flex-col bg-ink/95 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            const end = e.changedTouches[0]?.clientX;
            touchX.current = null;
            if (start === null || end === undefined) return;
            const dx = end - start;
            if (Math.abs(dx) > 60) go(dx > 0 ? -1 : 1);
          }}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
            <p className="text-sm text-muted" aria-live="polite">
              {index! + 1} / {items.length}
            </p>
            <div className="flex items-center gap-1">
              <IconButton label="Редактировать" onClick={() => onEdit(item)}>
                <Pencil className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton label="Удалить" onClick={() => onDelete(item)}>
                <Trash2 className="size-4" aria-hidden="true" />
              </IconButton>
              <button
                ref={closeRef}
                type="button"
                onClick={() => onIndexChange(null)}
                aria-label="Закрыть просмотр"
                className="grid size-11 place-items-center rounded-full text-text transition hover:bg-white/10"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element -- подписанный URL, не оптимизируется next/image
              <img
                key={item.id}
                src={src}
                alt={item.caption ?? item.title}
                decoding="async"
                className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              />
            ) : (
              <p className="text-muted">Фотография недоступна.</p>
            )}
            {!originalUrl && !failed && src ? (
              <Loader2
                className="absolute right-6 top-4 size-5 animate-spin text-accent"
                aria-label="Загружается оригинал"
              />
            ) : null}

            <NavButton side="left" label="Предыдущее" disabled={index === 0} onClick={() => go(-1)} />
            <NavButton
              side="right"
              label="Следующее"
              disabled={index === items.length - 1}
              onClick={() => go(1)}
            />
          </div>

          <div className="mx-auto w-full max-w-3xl px-6 pb-8 pt-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-accent">
              {formatDateRu(item.memoryDate)} · {item.category}
            </p>
            <h2 className="mt-2 font-display text-3xl font-light text-text">{item.title}</h2>
            {item.caption ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
                {item.caption}
              </p>
            ) : null}
            {failed ? (
              <p className="mt-2 text-xs text-muted">
                Оригинал не загрузился — показано превью.
              </p>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-text"
    >
      {children}
    </button>
  );
}

function NavButton({
  side,
  label,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-ink/60 text-text backdrop-blur transition hover:border-accent/60 disabled:opacity-20 sm:grid ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      <Icon className="size-6" aria-hidden="true" />
    </button>
  );
}
