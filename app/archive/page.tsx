import type { Metadata } from "next";
import Link from "next/link";
import { TotalDays } from "@/components/hero/time-counter";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { requireMember } from "@/lib/auth/session";
import { serverNowSeconds } from "@/lib/utils/server-now";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Личный архив" };

export default async function ArchivePage() {
  const me = await requireMember("/archive");
  const supabase = await createClient();

  const [memories, events, sent, received] = await Promise.all([
    supabase.from("memories").select("id", { count: "exact", head: true }),
    supabase.from("timeline_events").select("id", { count: "exact", head: true }),
    supabase.from("letters").select("id", { count: "exact", head: true }).eq("sender_id", me.id).eq("status", "sent"),
    supabase.from("letters").select("id", { count: "exact", head: true }).eq("recipient_id", me.id).not("opened_at", "is", null),
  ]);

  const stats = [
    { label: "Воспоминаний", value: memories.count ?? 0, href: "/memories" },
    { label: "Событий в хронологии", value: events.count ?? 0, href: "/timeline" },
    { label: "Писем отправлено", value: sent.count ?? 0, href: "/letters" },
    { label: "Писем прочитано", value: received.count ?? 0, href: "/letters" },
  ];

  return (
    <main id="main" className="mx-auto w-full max-w-7xl px-5 pb-32 pt-32 sm:px-8 sm:pt-40">
      <PageHeader
        eyebrow="Личный архив"
        title="Наша вселенная в цифрах"
        description="Всё, что вы сохранили вдвоём, — в одном месте."
      />
      <Reveal className="mb-16">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Дней вместе</p>
        <p className="mt-2 font-display text-7xl font-light text-text text-glow sm:text-9xl">
          <TotalDays initialNow={serverNowSeconds()} />
        </p>
      </Reveal>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Reveal as="li" key={s.label}>
            <Link
              href={s.href}
              className="block rounded-3xl border border-line bg-ink-2/60 p-6 transition hover:border-accent/50"
            >
              <p className="font-display text-6xl font-light text-text">{s.value}</p>
              <p className="mt-2 text-sm text-muted">{s.label}</p>
            </Link>
          </Reveal>
        ))}
      </ul>
    </main>
  );
}
