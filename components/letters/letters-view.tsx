"use client";

import { Lock, Pencil, PenLine, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { deleteLetter, openLetter, type OpenedLetter } from "@/lib/actions/letters";
import type { IncomingLetter, LettersOverview, OutgoingLetter } from "@/lib/data/letters";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils/cn";
import { formatCountdown, formatDateTimeRu } from "@/lib/utils/dates";
import { Envelope } from "./envelope";
import { LetterComposer, type ComposerState } from "./letter-composer";

const STATE_LABEL = {
  draft: "Черновик",
  sealed: "Запечатано",
  delivered: "Ждёт открытия",
  opened: "Прочитано",
} as const;

export function LettersView({ overview }: { overview: LettersOverview }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"in" | "out">("in");
  const [composer, setComposer] = useState<ComposerState>(null);
  const [deleting, setDeleting] = useState<OutgoingLetter | null>(null);
  const [reading, setReading] = useState<{ id: string; opened: OpenedLetter | null; error?: string } | null>(null);

  // Обратный отсчёт: смещение серверного времени фиксируется один раз
  const [offset] = useState(() => new Date(overview.serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(overview.serverNow).getTime());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 30_000);
    return () => clearInterval(t);
  }, [offset]);

  async function open(letter: IncomingLetter) {
    setReading({ id: letter.id, opened: null });
    const res = await openLetter({ id: letter.id });
    if (res.ok) {
      setReading({ id: letter.id, opened: res.data });
      router.refresh();
    } else {
      setReading({ id: letter.id, opened: null, error: res.error });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const res = await deleteLetter({ id: deleting.id });
    if (res.ok || res.code === "not_found") {
      toast.success("Письмо удалено");
      setDeleting(null);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Письма"
        title="Слова, которые ждут"
        description="Письма друг другу — сразу или в назначенный день."
        actions={
          <Button onClick={() => setComposer({ letter: null })} disabled={!overview.partnerName}>
            <PenLine className="size-4" aria-hidden="true" />
            Написать письмо
          </Button>
        }
      />

      <div role="tablist" aria-label="Письма" className="mb-10 flex gap-2">
        {(
          [
            ["in", `Мне (${overview.incoming.length})`],
            ["out", `От меня (${overview.outgoing.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full border px-5 py-2 text-sm transition",
              tab === id ? "border-accent bg-accent/15 text-text" : "border-line text-muted hover:text-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "in" ? (
        <div role="tabpanel" id="panel-in" aria-labelledby="tab-in">
          {overview.incoming.length === 0 ? (
            <EmptyState title="Пока нет писем" description="Когда для вас напишут письмо, оно появится здесь." />
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {overview.incoming.map((l) => {
                const locked = !l.unlocked || (l.openAt !== null && new Date(l.openAt).getTime() > now);
                return (
                  <li key={l.id} className="rounded-3xl border border-line bg-ink-2/60 p-5">
                    <Envelope sealed={locked} open={Boolean(l.openedAt)} className="mx-auto max-w-[260px]" />
                    <p className="mt-5 text-xs uppercase tracking-[0.25em] text-accent">От: {l.senderName}</p>
                    <p className="mt-1 font-display text-2xl text-text">{l.title ?? "Письмо"}</p>
                    {locked && l.openAt ? (
                      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                        <Lock className="size-4" aria-hidden="true" />
                        Откроется через {formatCountdown(l.openAt, now)}
                      </p>
                    ) : null}
                    <Button
                      className="mt-5 w-full"
                      variant={l.openedAt ? "ghost" : "primary"}
                      disabled={locked}
                      onClick={() => void open(l)}
                    >
                      {locked ? "Запечатано" : l.openedAt ? "Перечитать" : "Открыть письмо"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div role="tabpanel" id="panel-out" aria-labelledby="tab-out">
          {overview.outgoing.length === 0 ? (
            <EmptyState title="Вы ещё ничего не писали" description="Напишите первое письмо." />
          ) : (
            <ul className="grid gap-4">
              {overview.outgoing.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-col gap-4 rounded-2xl border border-line bg-ink-2/60 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.25em] text-accent">
                      {STATE_LABEL[l.state]} · для {l.recipientName}
                    </p>
                    <p className="mt-1 truncate font-display text-2xl text-text">{l.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {l.state === "opened" && l.openedAt
                        ? `Прочитано ${formatDateTimeRu(l.openedAt, publicEnv.timezone)}`
                        : l.openAt
                          ? `Откроется ${formatDateTimeRu(l.openAt, publicEnv.timezone)}`
                          : `Изменено ${formatDateTimeRu(l.updatedAt, publicEnv.timezone)}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {l.editable ? (
                      <button
                        type="button"
                        onClick={() => setComposer({ letter: l })}
                        aria-label={`Редактировать: ${l.title}`}
                        className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-text"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDeleting(l)}
                      aria-label={`Удалить: ${l.title}`}
                      className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <LetterComposer
        state={composer}
        partnerName={overview.partnerName}
        onClose={() => setComposer(null)}
        onDone={() => router.refresh()}
      />

      <Modal
        open={reading !== null}
        onClose={() => setReading(null)}
        size="lg"
        title={reading?.opened?.title ?? "Письмо"}
        description={reading?.opened ? `От: ${reading.opened.senderName}` : undefined}
      >
        {reading?.error ? (
          <p role="alert" className="text-danger">{reading.error}</p>
        ) : reading?.opened ? (
          <article className="whitespace-pre-line font-display text-2xl font-light leading-relaxed text-text">
            {reading.opened.body}
          </article>
        ) : (
          <div role="status" className="mx-auto max-w-[300px] py-6">
            <Envelope open />
            <span className="sr-only">Открываем письмо…</span>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        danger
        title="Удалить письмо?"
        message={`«${deleting?.title ?? ""}» будет удалено без возможности восстановления.`}
        confirmLabel="Удалить"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
