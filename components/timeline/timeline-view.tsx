"use client";

import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";
import { deleteEvent } from "@/lib/actions/timeline";
import type { TimelineItem } from "@/lib/data/timeline";
import { formatDateRu } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";
import { EventDialog, type EventDialogState } from "./event-dialog";

export function TimelineView({ events }: { events: TimelineItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<EventDialogState>(null);
  const [deleting, setDeleting] = useState<TimelineItem | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    const res = await deleteEvent({ id: deleting.id });
    if (res.ok || res.code === "not_found") {
      toast.success("Событие удалено");
      setDeleting(null);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Timeline"
        title="Наша хронология"
        description="События, из которых сложилась история — от первого дня."
        actions={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            Добавить событие
          </Button>
        }
      />

      {events.length === 0 ? (
        <EmptyState title="Здесь начнёт собираться наша история" description="Добавьте первое событие." />
      ) : (
        <ol className="relative mx-auto max-w-5xl pl-8 sm:pl-0">
          {/* Вертикальная линия: слева на мобильных, по центру на широких экранах */}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-2 top-0 w-px bg-gradient-to-b from-transparent via-accent/50 to-transparent sm:left-1/2"
          />
          {events.map((e, i) => {
            const right = i % 2 === 1;
            return (
              <Reveal as="li" key={e.id} className="relative mb-14 sm:mb-20 sm:grid sm:grid-cols-2 sm:gap-16">
                <span
                  aria-hidden="true"
                  className="absolute -left-[30px] top-2 size-3 rounded-full border border-accent bg-ink glow-accent sm:left-1/2 sm:-translate-x-1/2"
                />
                <article
                  className={cn(
                    "rounded-3xl border border-line bg-ink-2/60 p-6 backdrop-blur",
                    right ? "sm:col-start-2" : "sm:col-start-1 sm:text-right",
                  )}
                >
                  <time dateTime={e.eventDate} className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
                    {formatDateRu(e.eventDate)}
                  </time>
                  <h2 className="mt-3 font-display text-3xl font-light text-text sm:text-4xl">{e.title}</h2>
                  {e.location ? (
                    <p className={cn("mt-2 flex items-center gap-1.5 text-sm text-muted", !right && "sm:justify-end")}>
                      <MapPin className="size-4" aria-hidden="true" />
                      {e.location}
                    </p>
                  ) : null}
                  {e.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- подписанный URL
                    <img
                      src={e.coverUrl}
                      alt={`Обложка: ${e.title}`}
                      loading="lazy"
                      decoding="async"
                      className="mt-5 max-h-72 w-full rounded-2xl object-cover"
                    />
                  ) : null}
                  {e.description ? (
                    <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted">{e.description}</p>
                  ) : null}
                  <div className={cn("mt-5 flex gap-1", !right && "sm:justify-end")}>
                    <button
                      type="button"
                      onClick={() => setDialog({ mode: "edit", event: e })}
                      aria-label={`Редактировать: ${e.title}`}
                      className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-text"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(e)}
                      aria-label={`Удалить: ${e.title}`}
                      className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </ol>
      )}

      <EventDialog state={dialog} onClose={() => setDialog(null)} onDone={() => router.refresh()} />
      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Удалить событие?"
        message={`«${deleting?.title ?? ""}» будет удалено без возможности восстановления.`}
        confirmLabel="Удалить"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
