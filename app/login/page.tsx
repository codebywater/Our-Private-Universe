import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Monogram } from "@/components/hero/logo";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { getAccess } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site-config";
import { safeNextPath } from "@/lib/utils/safe-redirect";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "/");
  const access = await getAccess();

  if (access.status === "member") redirect(next);

  const error = !isSupabaseConfigured ? "config" : params.error;

  return (
    <main
      id="main"
      className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-5 py-28"
    >
      {/* Атмосфера */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[140px]"
      />
      <div aria-hidden="true" className="vignette pointer-events-none absolute inset-0 -z-10" />

      <div className="panel w-full max-w-md rounded-[2rem] bg-ink-2/70 p-8 shadow-2xl sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Monogram size="md" className="mb-6" />
          <p className="mb-3 text-xs uppercase tracking-[0.35em] text-accent">
            {siteConfig.name}
          </p>
          <h1 className="font-display text-4xl font-light leading-tight text-text">
            Только для двоих
          </h1>
        </div>

        {access.status === "forbidden" ? (
          <div className="flex flex-col gap-6" role="alert">
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-danger">
              Вы вошли как {access.email ?? "неизвестный пользователь"}, но этого
              аккаунта нет в списке допущенных. Выйдите и войдите с адресом,
              который добавил владелец архива.
            </p>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="lg" className="w-full">
                Выйти
              </Button>
            </form>
          </div>
        ) : (
          <LoginForm next={next} initialError={error} />
        )}
      </div>
    </main>
  );
}
